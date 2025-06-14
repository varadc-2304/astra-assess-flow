
-- Drop the existing update policy which is missing a WITH CHECK clause
DROP POLICY IF EXISTS "Users can update their own recordings" ON storage.objects;

-- Recreate the update policy with both USING and WITH CHECK clauses
CREATE POLICY "Users can update their own recordings"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'proctoring_recordings' AND
  auth.uid() = (storage.foldername(name))[1]::uuid
)
WITH CHECK (
  bucket_id = 'proctoring_recordings' AND
  auth.uid() = (storage.foldername(name))[1]::uuid
);
