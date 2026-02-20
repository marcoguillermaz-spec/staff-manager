import { createClient as createServiceClient } from '@supabase/supabase-js';

const BUCKET = 'documents';
const SIGNED_URL_TTL = 60 * 60; // 1 hour

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// Storage path format: {userId}/{documentId}/{filename}
export function buildStoragePath(userId: string, documentId: string, fileName: string): string {
  return `${userId}/${documentId}/${fileName}`;
}

export function buildSignedStoragePath(userId: string, documentId: string, fileName: string): string {
  return `${userId}/${documentId}/firmato_${fileName}`;
}

// Upload a buffer to Supabase Storage using service role (server-side use, e.g. CU batch)
export async function uploadBuffer(
  storagePath: string,
  buffer: Buffer | Uint8Array,
  contentType = 'application/pdf',
): Promise<{ path: string; error: string | null }> {
  const service = getServiceClient();
  const { error } = await service.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType, upsert: false });
  return { path: storagePath, error: error?.message ?? null };
}

// Generate a signed URL for a stored file (server-side)
export async function getSignedUrl(storagePath: string): Promise<string | null> {
  const service = getServiceClient();
  const { data, error } = await service.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL);
  if (error || !data) return null;
  return data.signedUrl;
}

// Generate signed URLs for original + signed file (both optional)
export async function getDocumentUrls(
  fileOriginalPath: string,
  fileFirmatoPath: string | null,
): Promise<{ originalUrl: string | null; firmatoUrl: string | null }> {
  const [originalUrl, firmatoUrl] = await Promise.all([
    getSignedUrl(fileOriginalPath),
    fileFirmatoPath ? getSignedUrl(fileFirmatoPath) : Promise.resolve(null),
  ]);
  return { originalUrl, firmatoUrl };
}
