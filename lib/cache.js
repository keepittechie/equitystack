export const PUBLIC_REVALIDATE_SECONDS = 3600;
export const REPORT_REVALIDATE_SECONDS = 1800;

export function withRevalidate(revalidate = PUBLIC_REVALIDATE_SECONDS) {
  return {
    next: {
      revalidate,
    },
  };
}
