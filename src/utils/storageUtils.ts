
import { supabase } from '@/integrations/supabase/client';

export async function verifyStorageBucket() {
  console.log('=== VERIFYING STORAGE BUCKET ===');
  
  try {
    // Check if bucket exists
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error('Error fetching buckets:', bucketsError);
      return false;
    }
    
    console.log('Available buckets:', buckets?.map(b => b.name));
    
    const targetBucket = buckets?.find(b => b.name === 'proctoring-recordings');
    if (!targetBucket) {
      console.error('proctoring-recordings bucket not found!');
      return false;
    }
    
    console.log('Target bucket found:', targetBucket);
    return true;
  } catch (error) {
    console.error('Error verifying bucket:', error);
    return false;
  }
}

export async function uploadVideoBlob(
  blob: Blob,
  filePath: string,
  onProgress?: (progress: number) => void
): Promise<string | null> {
  console.log('=== STARTING UPLOAD ===');
  console.log('File path:', filePath);
  console.log('Blob size:', blob.size, 'bytes');
  console.log('Blob type:', blob.type);
  
  if (blob.size === 0) {
    console.error('Cannot upload empty blob');
    return null;
  }
  
  try {
    onProgress?.(10);
    
    // Verify bucket exists
    const bucketExists = await verifyStorageBucket();
    if (!bucketExists) {
      throw new Error('Storage bucket verification failed');
    }
    
    onProgress?.(20);
    
    // Convert blob to ArrayBuffer
    const arrayBuffer = await blob.arrayBuffer();
    console.log('ArrayBuffer size:', arrayBuffer.byteLength);
    
    onProgress?.(30);
    
    // Upload file
    console.log('Starting upload to Supabase Storage...');
    const { data, error } = await supabase.storage
      .from('proctoring-recordings')
      .upload(filePath, arrayBuffer, {
        contentType: 'video/webm',
        upsert: true // Allow overwriting
      });
    
    if (error) {
      console.error('Upload error:', error);
      throw error;
    }
    
    console.log('Upload successful:', data);
    onProgress?.(80);
    
    // Verify upload by listing files
    const pathParts = filePath.split('/');
    const directory = pathParts.slice(0, -1).join('/');
    
    const { data: files, error: listError } = await supabase.storage
      .from('proctoring-recordings')
      .list(directory);
    
    if (listError) {
      console.warn('Could not verify upload:', listError);
    } else {
      const fileName = pathParts[pathParts.length - 1];
      const uploadedFile = files?.find(f => f.name === fileName);
      console.log('Upload verification:', uploadedFile ? 'SUCCESS' : 'FAILED');
    }
    
    onProgress?.(100);
    
    return data.path;
  } catch (error) {
    console.error('Upload failed:', error);
    return null;
  }
}
