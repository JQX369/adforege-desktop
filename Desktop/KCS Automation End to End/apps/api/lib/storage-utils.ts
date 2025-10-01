import { promises as fs } from "fs";
import path from "path";

export const loadAssetAsBuffer = async (relativePath: string): Promise<Buffer> => {
  const absolutePath = path.resolve(process.cwd(), relativePath);
  return fs.readFile(absolutePath);
};

