import { Router } from 'express';
import subjectRoutes from './subjects';
import resourceRoutes from './resources';
import flashcardRoutes from './flashcards';
import searchRoutes from './search';
import aiRoutes from './ai';

const router = Router();

router.use('/subjects', subjectRoutes);
router.use('/resources', resourceRoutes);
router.use('/flashcards', flashcardRoutes);
router.use('/search', searchRoutes);
router.use('/ai', aiRoutes);

export default router;
