import { ApiError } from "../middleware/error-handler.js";

export interface MapBasemapInput {
  tileUrl: string | null;
  imageUrl: string | null;
  south: number | null;
  west: number | null;
  north: number | null;
  east: number | null;
}

function blankToNull(value: string | null): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\/.+/i.test(value);
}

/** Normalise le fond de carte client : flux XYZ, sinon image bornée par deux coins. */
export function parseMapBasemap(input: MapBasemapInput): MapBasemapInput {
  const tileUrl = blankToNull(input.tileUrl);
  const imageUrl = blankToNull(input.imageUrl);

  if (tileUrl && !isHttpUrl(tileUrl)) {
    throw new ApiError(422, "INVALID_TILE_URL", "L'URL de tuiles doit commencer par http:// ou https://");
  }
  if (tileUrl && !(tileUrl.includes("{z}") && tileUrl.includes("{x}") && tileUrl.includes("{y}"))) {
    throw new ApiError(
      422,
      "INVALID_TILE_URL",
      "L'URL de tuiles doit contenir {z}, {x} et {y}",
    );
  }
  if (imageUrl && !isHttpUrl(imageUrl)) {
    throw new ApiError(422, "INVALID_IMAGE_URL", "L'URL de l'image doit commencer par http:// ou https://");
  }

  const bounds = [input.south, input.west, input.north, input.east];
  const anyBound = bounds.some((value) => value != null);
  const allBounds = bounds.every((value) => value != null);
  if (imageUrl && !allBounds) {
    throw new ApiError(422, "IMAGE_BOUNDS_REQUIRED", "Indiquez les deux coins de l'image");
  }
  if (!imageUrl && anyBound) {
    throw new ApiError(422, "IMAGE_URL_REQUIRED", "Indiquez l'URL de l'image");
  }
  if (
    allBounds &&
    input.south != null &&
    input.north != null &&
    input.west != null &&
    input.east != null
  ) {
    if (input.south < -90 || input.north > 90 || input.south >= input.north) {
      throw new ApiError(422, "INVALID_BOUNDS", "Le coin sud doit être au-dessous du coin nord");
    }
    if (input.west < -180 || input.east > 180 || input.west >= input.east) {
      throw new ApiError(422, "INVALID_BOUNDS", "Le coin ouest doit être à gauche du coin est");
    }
  }

  return {
    tileUrl,
    imageUrl,
    south: imageUrl ? input.south : null,
    west: imageUrl ? input.west : null,
    north: imageUrl ? input.north : null,
    east: imageUrl ? input.east : null,
  };
}
