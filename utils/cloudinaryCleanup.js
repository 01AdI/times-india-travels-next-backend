const cloudinary = require("cloudinary").v2;

async function deleteCloudinaryAsset(publicId, resourceType = "image") {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (error) {
    console.error(`Failed to delete Cloudinary asset "${publicId}":`, error);
  }
}

// Deletes every Cloudinary asset referenced by a deleted document, given
// the list of *PublicId field names to check on it.
// Example: cleanupDocumentImages(deletedPackage, ["thumbnailPublicId", "heroImagePublicId"])
async function cleanupDocumentImages(deletedDoc, publicIdFields, resourceType = "image") {
  if (!deletedDoc) return;
  await Promise.all(publicIdFields.map((field) => deleteCloudinaryAsset(deletedDoc[field], resourceType)));
}

// For array-of-image fields, like TourCategory.destinations_gallery.
async function cleanupGalleryImages(gallery, resourceType = "image") {
  if (!gallery || gallery.length === 0) return;
  await Promise.all(gallery.map((item) => deleteCloudinaryAsset(item.publicId, resourceType)));
}

module.exports = { deleteCloudinaryAsset, cleanupDocumentImages, cleanupGalleryImages };