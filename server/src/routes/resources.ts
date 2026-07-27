import { Router } from 'express';
import * as resourceCtrl from '../controllers/resourceController';
import * as flashcardCtrl from '../controllers/flashcardController';
import { upload } from '../middleware/upload';
import { attachResource } from '../middleware/attachResource';

const router = Router();

// attachResource runs before multer to pre-load subjectId into req
router.get('/:id', resourceCtrl.getResource);
router.put('/:id', attachResource, upload.single('file'), resourceCtrl.updateResource);
router.delete('/:id', resourceCtrl.deleteResource);

// File serving
router.get('/:id/download', resourceCtrl.downloadResource);
router.get('/:id/view', resourceCtrl.viewResource);

// Flashcard sub-collection
router.get('/:id/flashcards', flashcardCtrl.getFlashcards);
router.post('/:id/flashcards', flashcardCtrl.createFlashcard);

export default router;
