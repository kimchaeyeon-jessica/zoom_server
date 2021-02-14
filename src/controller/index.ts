import express from 'express';
import schoolController from './school.controller';

const router = express.Router();

router.use('/schools', schoolController); 

export default router;