
-- Create the proctoring recordings bucket if it doesn't exist
insert into storage.buckets (id, name, public)
values ('proctoring_recordings', 'proctoring_recordings', true)
on conflict (id) do nothing;

-- Create storage policies for the bucket
create policy "Allow authenticated users to upload recordings" 
on storage.objects
for insert
to authenticated
with check (bucket_id = 'proctoring_recordings');

create policy "Allow public access to recordings" 
on storage.objects
for select
using (bucket_id = 'proctoring_recordings');

create policy "Allow users to update their recordings" 
on storage.objects
for update
to authenticated
using (bucket_id = 'proctoring_recordings');

create policy "Allow users to delete their recordings" 
on storage.objects
for delete 
to authenticated
using (bucket_id = 'proctoring_recordings');

-- Ensure submissions table has recording_url column
alter table submissions
add column if not exists recording_url text;
