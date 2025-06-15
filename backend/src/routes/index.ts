import { Router } from 'express';

const router = Router();

router.get('/', (req, res) => {
  res.send('✅ Hello from the Nexus API!');
});

export default router;

