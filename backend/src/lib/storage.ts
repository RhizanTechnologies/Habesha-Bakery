import path from 'path';
import fs from 'fs';

const uploadsDir = path.join(process.cwd(), 'uploads');
const avatarsDir = path.join(uploadsDir, 'avatars');
const documentsDir = path.join(uploadsDir, 'documents');

for (const dir of [uploadsDir, avatarsDir, documentsDir]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export async function uploadToStorage(
  file: Express.Multer.File,
  folder: 'avatars' | 'documents'
): Promise<string> {
  const rawExt = path.extname(file.originalname).toLowerCase();
  const fallbackExt = folder === 'avatars' ? '.jpg' : '.pdf';
  const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${rawExt || fallbackExt}`;
  const targetDir = folder === 'avatars' ? avatarsDir : documentsDir;
  const filePath = path.join(targetDir, filename);

  const fileBuffer = file.buffer || (file.path && fs.existsSync(file.path) ? fs.readFileSync(file.path) : null);
  if (!fileBuffer) {
    throw new Error('Unable to read uploaded file data');
  }

  fs.writeFileSync(filePath, fileBuffer);
  return `/uploads/${folder}/${filename}`;
}
