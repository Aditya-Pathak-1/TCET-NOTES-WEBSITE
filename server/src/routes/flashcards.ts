import { Router } from 'express';
import * as flashcardCtrl from '../controllers/flashcardController';

const router = Router();

router.put('/:id', flashcardCtrl.updateFlashcard);
router.delete('/:id', flashcardCtrl.deleteFlashcard);

export default router;
