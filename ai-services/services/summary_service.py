"""
Summary Service for Nexus AI Services
=====================================

This service generates intelligent meeting summaries from transcriptions,
extracting key points, decisions, action items, and insights.
"""

import asyncio
import json
import logging
import re
import time
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta

import openai
from transformers import pipeline, AutoTokenizer, AutoModelForSeq2SeqLM
import spacy
from textstat import flesch_reading_ease, syllable_count
import nltk
from nltk.corpus import stopwords
from nltk.tokenize import sent_tokenize, word_tokenize
from nltk.tag import pos_tag
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.cluster import KMeans
import numpy as np

from core.config import settings
from services.redis_service import RedisService
from services.kafka_service import KafkaService
from utils.text_processing import TextProcessor
from utils.metrics import track_performance, increment_counter

# ===================================
# DATA CLASSES
# ===================================

@dataclass
class ActionItem:
    """Represents an action item extracted from the meeting."""
    description: str
    assigned_to: Optional[str] = None
    due_date: Optional[str] = None
    priority: str = "medium"  # low, medium, high
    category: Optional[str] = None
    confidence: float = 0.0

@dataclass
class Decision:
    """Represents a decision made during the meeting."""
    description: str
    context: str
    participants: List[str]
    timestamp: Optional[float] = None
    confidence: float = 0.0

@dataclass
class KeyPoint:
    """Represents a key point from the meeting."""
    text: str
    category: str  # discussion, announcement, question, etc.
    importance: float = 0.0
    speakers: List[str] = None
    timestamp: Optional[float] = None

@dataclass
class TopicAnalysis:
    """Represents topic analysis of the meeting."""
    topic: str
    keywords: List[str]
    duration: float  # minutes
    participants: List[str]
    sentiment: str = "neutral"
    importance: float = 0.0

@dataclass
class MeetingSummary:
    """Complete meeting summary."""
    meeting_id: str
    title: str
    duration: int  # seconds
    participant_count: int
    
    # Summary content
    executive_summary: str
    key_points: List[KeyPoint]
    decisions: List[Decision]
    action_items: List[ActionItem]
    topics: List[TopicAnalysis]
    
    # Metrics
    overall_sentiment: str
    engagement_level: str
    productivity_score: float
    
    # Metadata
    generated_at: datetime
    confidence: float
    language: str = "en"

# ===================================
# SUMMARY SERVICE
# ===================================

class SummaryService:
    """Main summary generation service."""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.redis: Optional[RedisService] = None
        self.kafka: Optional[KafkaService] = None
        
        # Models and processors
        self.openai_client: Optional[openai.AsyncOpenAI] = None
        self.summarization_model = None
        self.tokenizer = None
        self.nlp = None
        self.text_processor = TextProcessor()
        
        # Stop words and patterns
        self.stop_words = set(stopwords.words('english'))
        self.action_patterns = [
            r"(?:will|should|need to|must|have to)\s+(.+?)(?:\.|$)",
            r"action item[:\s]+(.+?)(?:\.|$)",
            r"(?:assigned to|@)(\w+)",
            r"by\s+(\w+day|\d{1,2}[\/\-]\d{1,2}|\w+\s+\d{1,2})"
        ]
        self.decision_patterns = [
            r"(?:decided|agreed|concluded|determined)\s+(?:that\s+)?(.+?)(?:\.|$)",
            r"decision[:\s]+(.+?)(?:\.|$)",
            r"we\s+(?:will|are going to|have decided to)\s+(.+?)(?:\.|$)"
        ]
        
        # Performance tracking
        self.performance_metrics = {
            "summaries_generated": 0,
            "total_processing_time": 0,
            "average_processing_time": 0,
            "error_count": 0,
        }

    async def initialize(self) -> None:
        """Initialize the summary service."""
        try:
            self.logger.info("Initializing Summary Service...")
            
            # Initialize Redis and Kafka
            self.redis = RedisService()
            self.kafka = KafkaService()
            
            # Initialize OpenAI client
            if settings.OPENAI_API_KEY:
                self.openai_client = openai.AsyncOpenAI(
                    api_key=settings.OPENAI_API_KEY,
                    timeout=settings.OPENAI_REQUEST_TIMEOUT
                )
            
            # Load summarization model
            await self._load_summarization_model()
            
            # Load NLP model
            await self._load_nlp_model()
            
            # Download NLTK data
            await self._setup_nltk()
            
            self.logger.info("✅ Summary Service initialized successfully")
            
        except Exception as e:
            self.logger.error(f"❌ Failed to initialize Summary Service: {e}")
            raise

    async def _load_summarization_model(self) -> None:
        """Load the summarization model."""
        def load_model():
            tokenizer = AutoTokenizer.from_pretrained(
                settings.SUMMARIZATION_MODEL,
                cache_dir=str(settings.MODEL_CACHE_DIR)
            )
            model = AutoModelForSeq2SeqLM.from_pretrained(
                settings.SUMMARIZATION_MODEL,
                cache_dir=str(settings.MODEL_CACHE_DIR)
            )
            
            summarizer = pipeline(
                "summarization",
                model=model,
                tokenizer=tokenizer,
                max_length=settings.SUMMARY_TARGET_LENGTH,
                min_length=50,
                do_sample=False
            )
            return summarizer, tokenizer
        
        self.summarization_model, self.tokenizer = await asyncio.get_event_loop().run_in_executor(
            None, load_model
        )
        self.logger.info(f"✅ Summarization model '{settings.SUMMARIZATION_MODEL}' loaded")

    async def _load_nlp_model(self) -> None:
        """Load spaCy NLP model."""
        def load_spacy():
            try:
                return spacy.load("en_core_web_sm")
            except OSError:
                self.logger.warning("spaCy model not found, downloading...")
                spacy.cli.download("en_core_web_sm")
                return spacy.load("en_core_web_sm")
        
        self.nlp = await asyncio.get_event_loop().run_in_executor(
            None, load_spacy
        )
        self.logger.info("✅ spaCy NLP model loaded")

    async def _setup_nltk(self) -> None:
        """Setup NLTK data."""
        def download_nltk_data():
            try:
                nltk.data.find('tokenizers/punkt')
                nltk.data.find('corpora/stopwords')
                nltk.data.find('taggers/averaged_perceptron_tagger')
            except LookupError:
                nltk.download('punkt', quiet=True)
                nltk.download('stopwords', quiet=True)
                nltk.download('averaged_perceptron_tagger', quiet=True)
        
        await asyncio.get_event_loop().run_in_executor(
            None, download_nltk_data
        )
        self.logger.info("✅ NLTK data ready")

    async def generate_meeting_summary(self, meeting_id: str) -> Optional[MeetingSummary]:
        """Generate a comprehensive summary for a meeting."""
        try:
            start_time = time.time()
            self.logger.info(f"Generating summary for meeting {meeting_id}")
            
            # Get meeting data and transcription
            meeting_data = await self._get_meeting_data(meeting_id)
            if not meeting_data:
                self.logger.warning(f"No meeting data found for {meeting_id}")
                return None
            
            transcription_text = await self._get_transcription_text(meeting_id)
            if not transcription_text or len(transcription_text.strip()) < 100:
                self.logger.warning(f"Insufficient transcription data for {meeting_id}")
                return None
            
            # Check minimum meeting duration
            if meeting_data.get('duration', 0) < settings.SUMMARY_MIN_MEETING_DURATION:
                self.logger.info(f"Meeting {meeting_id} too short for summary generation")
                return None
            
            # Preprocess text
            processed_text = await self.text_processor.preprocess(transcription_text)
            
            # Generate different components
            executive_summary = await self._generate_executive_summary(processed_text, meeting_data)
            key_points = await self._extract_key_points(processed_text, meeting_data)
            decisions = await self._extract_decisions(processed_text, meeting_data)
            action_items = await self._extract_action_items(processed_text, meeting_data)
            topics = await self._analyze_topics(processed_text, meeting_data)
            
            # Calculate metrics
            overall_sentiment = await self._analyze_overall_sentiment(processed_text)
            engagement_level = await self._calculate_engagement_level(meeting_data)
            productivity_score = await self._calculate_productivity_score(
                len(decisions), len(action_items), len(key_points), meeting_data.get('duration', 0)
            )
            
            # Create summary object
            summary = MeetingSummary(
                meeting_id=meeting_id,
                title=meeting_data.get('title', 'Meeting Summary'),
                duration=meeting_data.get('duration', 0),
                participant_count=meeting_data.get('participant_count', 0),
                executive_summary=executive_summary,
                key_points=key_points,
                decisions=decisions,
                action_items=action_items,
                topics=topics,
                overall_sentiment=overall_sentiment,
                engagement_level=engagement_level,
                productivity_score=productivity_score,
                generated_at=datetime.utcnow(),
                confidence=await self._calculate_summary_confidence(processed_text),
                language="en"
            )
            
            # Save summary
            await self._save_summary(summary)
            
            # Publish event
            await self._publish_summary_event(summary)
            
            # Cache summary
            await self._cache_summary(summary)
            
            # Update metrics
            processing_time = time.time() - start_time
            self.performance_metrics["summaries_generated"] += 1
            self.performance_metrics["total_processing_time"] += processing_time
            self.performance_metrics["average_processing_time"] = (
                self.performance_metrics["total_processing_time"] / 
                self.performance_metrics["summaries_generated"]
            )
            
            # Track metrics
            increment_counter("summaries_generated")
            track_performance("summary_generation_time", processing_time)
            
            self.logger.info(f"Summary generated for meeting {meeting_id} in {processing_time:.2f}s")
            return summary
            
        except Exception as e:
            self.logger.error(f"Error generating summary for meeting {meeting_id}: {e}")
            self.performance_metrics["error_count"] += 1
            increment_counter("summary_errors")
            return None

    async def _get_meeting_data(self, meeting_id: str) -> Optional[Dict[str, Any]]:
        """Get meeting metadata from database."""
        try:
            # This would integrate with your database layer
            # For now, we'll simulate the data
            return {
                "title": "Team Meeting",
                "duration": 3600,  # 1 hour
                "participant_count": 5,
                "start_time": datetime.utcnow() - timedelta(hours=1),
                "end_time": datetime.utcnow(),
            }
        except Exception as e:
            self.logger.error(f"Failed to get meeting data: {e}")
            return None

    async def _get_transcription_text(self, meeting_id: str) -> Optional[str]:
        """Get transcription text from database."""
        try:
            # This would integrate with your database layer
            # For now, we'll simulate the data
            return """
            John: Welcome everyone to today's team meeting. Let's start by reviewing our progress.
            Sarah: Thanks John. We've completed the user authentication module and it's ready for testing.
            Mike: Great work Sarah. I'll handle the testing this week. We should also discuss the API integration.
            John: Good point Mike. Sarah, can you document the authentication flow by Friday?
            Sarah: Absolutely, I'll have the documentation ready by Thursday.
            Lisa: I wanted to bring up the performance issues we're seeing in production.
            John: That's important Lisa. Let's schedule a separate meeting to dive deep into that.
            Mike: I agree. We need to prioritize fixing those issues.
            John: Alright, let's wrap up. Action items: Sarah documents auth flow, Mike tests the module, and I'll schedule the performance review meeting.
            """
        except Exception as e:
            self.logger.error(f"Failed to get transcription: {e}")
            return None

    async def _generate_executive_summary(self, text: str, meeting_data: Dict[str, Any]) -> str:
        """Generate an executive summary using AI models."""
        try:
            # Use OpenAI if available, otherwise use local model
            if self.openai_client and settings.OPENAI_API_KEY:
                return await self._generate_openai_summary(text, meeting_data)
            else:
                return await self._generate_local_summary(text)
                
        except Exception as e:
            self.logger.error(f"Error generating executive summary: {e}")
            return "Unable to generate summary due to processing error."

    async def _generate_openai_summary(self, text: str, meeting_data: Dict[str, Any]) -> str:
        """Generate summary using OpenAI."""
        try:
            prompt = f"""
            Please provide a concise executive summary of this meeting transcript.
            
            Meeting Details:
            - Title: {meeting_data.get('title', 'Team Meeting')}
            - Duration: {meeting_data.get('duration', 0) // 60} minutes
            - Participants: {meeting_data.get('participant_count', 0)}
            
            Transcript:
            {text[:settings.SUMMARY_MAX_INPUT_LENGTH]}
            
            Please include:
            1. Main topics discussed
            2. Key outcomes
            3. Overall meeting effectiveness
            
            Keep the summary to 2-3 paragraphs.
            """
            
            response = await self.openai_client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=[
                    {"role": "system", "content": "You are an expert meeting summarizer. Provide clear, concise, and actionable summaries."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=settings.OPENAI_MAX_TOKENS,
                temperature=settings.OPENAI_TEMPERATURE
            )
            
            return response.choices[0].message.content.strip()
            
        except Exception as e:
            self.logger.error(f"OpenAI summary generation failed: {e}")
            # Fallback to local model
            return await self._generate_local_summary(text)

    async def _generate_local_summary(self, text: str) -> str:
        """Generate summary using local model."""
        def summarize():
            try:
                # Truncate text if too long
                max_length = 1024  # BART limit
                if len(text) > max_length:
                    text_truncated = text[:max_length]
                else:
                    text_truncated = text
                
                summary = self.summarization_model(
                    text_truncated,
                    max_length=200,
                    min_length=50,
                    do_sample=False
                )
                
                return summary[0]['summary_text']
                
            except Exception as e:
                self.logger.error(f"Local summarization failed: {e}")
                return "Meeting summary unavailable due to processing limitations."
        
        return await asyncio.get_event_loop().run_in_executor(None, summarize)

    async def _extract_key_points(self, text: str, meeting_data: Dict[str, Any]) -> List[KeyPoint]:
        """Extract key points from the meeting transcript."""
        try:
            key_points = []
            
            # Split into sentences
            sentences = sent_tokenize(text)
            
            # Score sentences for importance
            sentence_scores = await self._score_sentences(sentences)
            
            # Select top sentences as key points
            top_sentences = sorted(
                zip(sentences, sentence_scores), 
                key=lambda x: x[1], 
                reverse=True
            )[:10]  # Top 10 sentences
            
            for sentence, score in top_sentences:
                if score > 0.3:  # Minimum threshold
                    category = await self._categorize_sentence(sentence)
                    speakers = await self._extract_speakers(sentence)
                    
                    key_points.append(KeyPoint(
                        text=sentence.strip(),
                        category=category,
                        importance=score,
                        speakers=speakers
                    ))
            
            return key_points
            
        except Exception as e:
            self.logger.error(f"Error extracting key points: {e}")
            return []

    async def _extract_decisions(self, text: str, meeting_data: Dict[str, Any]) -> List[Decision]:
        """Extract decisions made during the meeting."""
        try:
            decisions = []
            
            for pattern in self.decision_patterns:
                matches = re.finditer(pattern, text, re.IGNORECASE)
                
                for match in matches:
                    decision_text = match.group(1).strip()
                    
                    if len(decision_text) > 10:  # Minimum length
                        # Get context (surrounding text)
                        start = max(0, match.start() - 100)
                        end = min(len(text), match.end() + 100)
                        context = text[start:end].strip()
                        
                        # Extract participants from context
                        participants = await self._extract_speakers(context)
                        
                        decisions.append(Decision(
                            description=decision_text,
                            context=context,
                            participants=participants,
                            confidence=0.8
                        ))
            
            # Remove duplicates
            unique_decisions = []
            seen_descriptions = set()
            
            for decision in decisions:
                if decision.description not in seen_descriptions:
                    unique_decisions.append(decision)
                    seen_descriptions.add(decision.description)
            
            return unique_decisions[:5]  # Limit to top 5
            
        except Exception as e:
            self.logger.error(f"Error extracting decisions: {e}")
            return []

    async def _extract_action_items(self, text: str, meeting_data: Dict[str, Any]) -> List[ActionItem]:
        """Extract action items from the meeting transcript."""
        try:
            action_items = []
            
            for pattern in self.action_patterns:
                matches = re.finditer(pattern, text, re.IGNORECASE)
                
                for match in matches:
                    action_text = match.group(1).strip()
                    
                    if len(action_text) > 5:  # Minimum length
                        # Extract assigned person
                        assigned_to = await self._extract_assignee(action_text, text)
                        
                        # Extract due date
                        due_date = await self._extract_due_date(action_text)
                        
                        # Determine priority
                        priority = await self._determine_priority(action_text)
                        
                        # Categorize action item
                        category = await self._categorize_action_item(action_text)
                        
                        action_items.append(ActionItem(
                            description=action_text,
                            assigned_to=assigned_to,
                            due_date=due_date,
                            priority=priority,
                            category=category,
                            confidence=0.7
                        ))
            
            # Remove duplicates
            unique_actions = []
            seen_descriptions = set()
            
            for action in action_items:
                if action.description not in seen_descriptions:
                    unique_actions.append(action)
                    seen_descriptions.add(action.description)
            
            return unique_actions[:10]  # Limit to top 10
            
        except Exception as e:
            self.logger.error(f"Error extracting action items: {e}")
            return []

    async def _analyze_topics(self, text: str, meeting_data: Dict[str, Any]) -> List[TopicAnalysis]:
        """Analyze topics discussed in the meeting."""
        try:
            # Use TF-IDF to extract keywords
            sentences = sent_tokenize(text)
            
            if len(sentences) < 3:
                return []
            
            # Vectorize sentences
            vectorizer = TfidfVectorizer(
                max_features=100,
                stop_words='english',
                ngram_range=(1, 2)
            )
            
            tfidf_matrix = vectorizer.fit_transform(sentences)
            feature_names = vectorizer.get_feature_names_out()
            
            # Cluster sentences into topics
            n_topics = min(5, len(sentences) // 3)  # Max 5 topics
            if n_topics < 2:
                n_topics = 2
            
            kmeans = KMeans(n_clusters=n_topics, random_state=42)
            clusters = kmeans.fit_predict(tfidf_matrix)
            
            topics = []
            
            for cluster_id in range(n_topics):
                # Get sentences in this cluster
                cluster_sentences = [
                    sentences[i] for i, c in enumerate(clusters) if c == cluster_id
                ]
                
                if not cluster_sentences:
                    continue
                
                # Get top keywords for this cluster
                cluster_center = kmeans.cluster_centers_[cluster_id]
                top_indices = cluster_center.argsort()[-10:][::-1]
                keywords = [feature_names[i] for i in top_indices]
                
                # Generate topic name from keywords
                topic_name = await self._generate_topic_name(keywords, cluster_sentences)
                
                # Extract speakers from cluster sentences
                speakers = []
                for sentence in cluster_sentences:
                    sentence_speakers = await self._extract_speakers(sentence)
                    speakers.extend(sentence_speakers)
                speakers = list(set(speakers))  # Remove duplicates
                
                # Calculate duration (rough estimate)
                duration = len(cluster_sentences) * 0.5  # Assume 30 seconds per sentence
                
                # Analyze sentiment
                sentiment = await self._analyze_cluster_sentiment(cluster_sentences)
                
                topics.append(TopicAnalysis(
                    topic=topic_name,
                    keywords=keywords[:5],
                    duration=duration,
                    participants=speakers,
                    sentiment=sentiment,
                    importance=len(cluster_sentences) / len(sentences)
                ))
            
            return sorted(topics, key=lambda x: x.importance, reverse=True)
            
        except Exception as e:
            self.logger.error(f"Error analyzing topics: {e}")
            return []

    async def _score_sentences(self, sentences: List[str]) -> List[float]:
        """Score sentences for importance."""
        scores = []
        
        for sentence in sentences:
            score = 0.0
            
            # Length score (prefer medium-length sentences)
            word_count = len(word_tokenize(sentence))
            if 10 <= word_count <= 30:
                score += 0.2
            
            # Keyword score (look for important words)
            important_words = [
                'decision', 'action', 'important', 'critical', 'urgent',
                'deadline', 'priority', 'goal', 'objective', 'result'
            ]
            for word in important_words:
                if word in sentence.lower():
                    score += 0.1
            
            # Position score (first and last sentences often important)
            if sentences.index(sentence) < len(sentences) * 0.1:
                score += 0.1
            if sentences.index(sentence) > len(sentences) * 0.9:
                score += 0.1
            
            scores.append(min(score, 1.0))
        
        return scores

    async def _categorize_sentence(self, sentence: str) -> str:
        """Categorize a sentence."""
        sentence_lower = sentence.lower()
        
        if any(word in sentence_lower for word in ['?', 'what', 'how', 'why', 'when', 'where']):
            return 'question'
        elif any(word in sentence_lower for word in ['decision', 'decided', 'agreed']):
            return 'decision'
        elif any(word in sentence_lower for word in ['action', 'will', 'should', 'need to']):
            return 'action'
        elif any(word in sentence_lower for word in ['announce', 'announcement', 'news']):
            return 'announcement'
        else:
            return 'discussion'

    async def _extract_speakers(self, text: str) -> List[str]:
        """Extract speaker names from text."""
        # Simple pattern matching for "Name:" format
        speaker_pattern = r'([A-Z][a-z]+):'
        matches = re.findall(speaker_pattern, text)
        return list(set(matches))

    async def _extract_assignee(self, action_text: str, full_text: str) -> Optional[str]:
        """Extract who is assigned to an action item."""
        # Look for patterns like "Sarah will", "@Sarah", "assigned to Sarah"
        patterns = [
            r'([A-Z][a-z]+)\s+will',
            r'@([A-Z][a-z]+)',
            r'assigned to ([A-Z][a-z]+)',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, action_text, re.IGNORECASE)
            if match:
                return match.group(1)
        
        return None

    async def _extract_due_date(self, action_text: str) -> Optional[str]:
        """Extract due date from action item."""
        date_patterns = [
            r'by (\w+day)',
            r'by (\w+ \d{1,2})',
            r'(\d{1,2}/\d{1,2})',
            r'(\d{1,2}-\d{1,2})',
        ]
        
        for pattern in date_patterns:
            match = re.search(pattern, action_text, re.IGNORECASE)
            if match:
                return match.group(1)
        
        return None

    async def _determine_priority(self, action_text: str) -> str:
        """Determine priority of action item."""
        text_lower = action_text.lower()
        
        if any(word in text_lower for word in ['urgent', 'asap', 'immediately', 'critical']):
            return 'high'
        elif any(word in text_lower for word in ['important', 'priority', 'soon']):
            return 'medium'
        else:
            return 'low'

    async def _categorize_action_item(self, action_text: str) -> Optional[str]:
        """Categorize an action item."""
        text_lower = action_text.lower()
        
        if any(word in text_lower for word in ['document', 'write', 'create', 'draft']):
            return 'documentation'
        elif any(word in text_lower for word in ['test', 'verify', 'check', 'validate']):
            return 'testing'
        elif any(word in text_lower for word in ['review', 'analyze', 'examine']):
            return 'review'
        elif any(word in text_lower for word in ['meeting', 'schedule', 'call']):
            return 'meeting'
        elif any(word in text_lower for word in ['fix', 'resolve', 'debug', 'troubleshoot']):
            return 'bug_fix'
        else:
            return 'general'

    async def _generate_topic_name(self, keywords: List[str], sentences: List[str]) -> str:
        """Generate a topic name from keywords and sentences."""
        # Simple approach: use the most common meaningful keyword
        meaningful_keywords = [
            kw for kw in keywords 
            if len(kw) > 3 and kw not in self.stop_words
        ]
        
        if meaningful_keywords:
            return meaningful_keywords[0].title()
        else:
            return "General Discussion"

    async def _analyze_overall_sentiment(self, text: str) -> str:
        """Analyze overall sentiment of the meeting."""
        # Simple keyword-based sentiment analysis
        positive_words = ['good', 'great', 'excellent', 'success', 'agree', 'happy', 'positive']
        negative_words = ['problem', 'issue', 'concern', 'difficult', 'challenge', 'disagree']
        
        text_lower = text.lower()
        positive_count = sum(1 for word in positive_words if word in text_lower)
        negative_count = sum(1 for word in negative_words if word in text_lower)
        
        if positive_count > negative_count + 2:
            return 'positive'
        elif negative_count > positive_count + 2:
            return 'negative'
        else:
            return 'neutral'

    async def _calculate_engagement_level(self, meeting_data: Dict[str, Any]) -> str:
        """Calculate engagement level based on meeting metrics."""
        duration = meeting_data.get('duration', 0)
        participant_count = meeting_data.get('participant_count', 0)
        
        # Simple heuristic
        if duration > 3600 and participant_count > 5:  # > 1 hour, > 5 people
            return 'high'
        elif duration > 1800 and participant_count > 2:  # > 30 min, > 2 people
            return 'medium'
        else:
            return 'low'

    async def _calculate_productivity_score(
        self, 
        decisions_count: int, 
        action_items_count: int, 
        key_points_count: int, 
        duration: int
    ) -> float:
        """Calculate productivity score (0-100)."""
        if duration == 0:
            return 0.0
        
        duration_hours = duration / 3600
        
        # Score based on outcomes per hour
        decisions_score = min(decisions_count / duration_hours * 10, 30)
        actions_score = min(action_items_count / duration_hours * 10, 40)
        points_score = min(key_points_count / duration_hours * 5, 30)
        
        total_score = decisions_score + actions_score + points_score
        return min(total_score, 100.0)

    async def _analyze_cluster_sentiment(self, sentences: List[str]) -> str:
        """Analyze sentiment of a cluster of sentences."""
        # Simple approach for now
        return await self._analyze_overall_sentiment(' '.join(sentences))

    async def _calculate_summary_confidence(self, text: str) -> float:
        """Calculate confidence score for the summary."""
        # Based on text length and quality
        word_count = len(word_tokenize(text))
        
        if word_count < 50:
            return 0.3
        elif word_count < 200:
            return 0.6
        elif word_count < 500:
            return 0.8
        else:
            return 0.9

    async def _save_summary(self, summary: MeetingSummary) -> None:
        """Save summary to database."""
        try:
            # This would integrate with your database layer
            self.logger.info(f"Saving summary for meeting {summary.meeting_id}")
            
        except Exception as e:
            self.logger.error(f"Failed to save summary: {e}")

    async def _publish_summary_event(self, summary: MeetingSummary) -> None:
        """Publish summary completion event to Kafka."""
        try:
            if self.kafka:
                event_data = {
                    "type": "summary_generated",
                    "meeting_id": summary.meeting_id,
                    "summary_id": f"summary_{summary.meeting_id}",
                    "data": {
                        "meeting_id": summary.meeting_id,
                        "confidence": summary.confidence,
                        "key_points_count": len(summary.key_points),
                        "decisions_count": len(summary.decisions),
                        "action_items_count": len(summary.action_items),
                        "productivity_score": summary.productivity_score
                    },
                    "timestamp": time.time()
                }
                
                await self.kafka.publish(
                    settings.KAFKA_TOPIC_SUMMARY,
                    json.dumps(event_data)
                )
                
        except Exception as e:
            self.logger.error(f"Failed to publish summary event: {e}")

    async def _cache_summary(self, summary: MeetingSummary) -> None:
        """Cache summary in Redis."""
        try:
            if self.redis:
                cache_key = f"summary:{summary.meeting_id}"
                cache_data = asdict(summary)
                
                # Convert datetime to string for JSON serialization
                cache_data['generated_at'] = summary.generated_at.isoformat()
                
                await self.redis.setex(
                    cache_key,
                    settings.CACHE_TTL_SUMMARY,
                    json.dumps(cache_data, default=str)
                )
                
        except Exception as e:
            self.logger.error(f"Failed to cache summary: {e}")

    async def health_check(self) -> Dict[str, Any]:
        """Perform health check for summary service."""
        try:
            health_status = {
                "status": "healthy",
                "openai_available": self.openai_client is not None,
                "summarization_model_loaded": self.summarization_model is not None,
                "nlp_model_loaded": self.nlp is not None,
                "performance_metrics": self.performance_metrics,
                "timestamp": time.time()
            }
            
            return health_status
            
        except Exception as e:
            self.logger.error(f"Health check failed: {e}")
            return {
                "status": "unhealthy",
                "error": str(e),
                "timestamp": time.time()
            }

    async def cleanup(self) -> None:
        """Cleanup resources."""
        try:
            self.logger.info("✅ Summary service cleanup completed")
            
        except Exception as e:
            self.logger.error(f"Error during cleanup: {e}")