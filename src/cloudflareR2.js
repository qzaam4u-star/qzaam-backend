const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const s3 = new S3Client({
  region: 'auto', // Required by AWS SDK, not used by R2
  endpoint: process.env.CLOUDFLARE_ENDPOINT_URL,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY,
    secretAccessKey: process.env.CLOUDFLARE_SECRET_KEY,
  },
});

// Uploads a buffer to R2 and returns its public URL.
async function uploadBuffer(buffer, key, contentType) {
  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.CLOUDFLARE_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  );

  return `${process.env.CLOUDFLARE_PUBLIC_URL}/${key}`;
}

// Deletes an object from R2 by key.
async function deleteObject(key) {
  await s3.send(
    new DeleteObjectCommand({
      Bucket: process.env.CLOUDFLARE_BUCKET_NAME,
      Key: key,
    }),
  );
}

module.exports = { uploadBuffer, deleteObject };
