/*
# Profile photo and cover storage

1. New Storage
- `profile-media` bucket for profile pictures and cover photos.
- Public read so avatars and covers can be shown by URL anywhere in the app.
- 5 MB file size limit; only JPEG, PNG, WebP and GIF images are accepted.

2. Security
- Signed-in users can upload, replace and delete files only inside their own folder (named with their user id).
- Users cannot write into another user's folder.
- No listing policy is added, so the bucket contents cannot be enumerated through the API.
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-media',
  'profile-media',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "profile_media_insert_own_folder" ON storage.objects;
CREATE POLICY "profile_media_insert_own_folder" ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "profile_media_update_own_folder" ON storage.objects;
CREATE POLICY "profile_media_update_own_folder" ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profile-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'profile-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "profile_media_delete_own_folder" ON storage.objects;
CREATE POLICY "profile_media_delete_own_folder" ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
