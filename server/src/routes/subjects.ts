import { Router } from 'express';
import * as subjectCtrl from '../controllers/subjectController';
import * as resourceCtrl from '../controllers/resourceController';
import { upload } from '../middleware/upload';

const router = Router();

// Subject CRUD
router.get('/', subjectCtrl.getSubjects);
router.post('/', subjectCtrl.createSubject);
router.get('/:id', subjectCtrl.getSubject);
router.put('/:id', subjectCtrl.updateSubject);
router.delete('/:id', subjectCtrl.deleteSubject);

// Resources nested under a subject
// Express matches /:subjectId/resources because it has two segments after base
router.get('/:subjectId/resources', resourceCtrl.getResources);
router.post('/:subjectId/resources', upload.single('file'), resourceCtrl.createResource);

export default router;
