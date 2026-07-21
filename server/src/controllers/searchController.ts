import { asyncHandler } from '../middleware/errorHandler';
import prisma from '../db/database';

export const search = asyncHandler(async (req, res) => {
  const q = (req.query.q as string)?.trim();
  if (!q) {
    res.json({ data: { subjects: [], resources: [] } });
    return;
  }

  const [subjects, rawResources] = await Promise.all([
    prisma.subject.findMany({
      where: {
        OR: [
          { name: { contains: q } },
          { description: { contains: q } },
        ],
      },
      take: 20,
      orderBy: { name: 'asc' },
    }),
    prisma.resource.findMany({
      where: {
        OR: [
          { title: { contains: q } },
          { fileName: { contains: q } },
        ],
      },
      include: { subject: { select: { name: true, color: true } } },
      take: 30,
      orderBy: { uploadedAt: 'desc' },
    }),
  ]);

  const resources = rawResources.map(({ subject, ...r }) => ({
    ...r,
    subjectName: subject.name,
    subjectColor: subject.color,
  }));

  res.json({ data: { subjects, resources } });
});
