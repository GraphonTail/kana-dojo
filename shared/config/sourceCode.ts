/**
 * Fork: AGPL-3.0 section 13 asks a modified version that people use over a
 * network to offer them its source code. On Vercel the repository and branch
 * of the build are known (framework environment variables), so the GitHub
 * buttons open the exact source this deployment was built from.
 * NEXT_PUBLIC_SOURCE_URL overrides the link.
 */
const repoOwner = process.env.NEXT_PUBLIC_VERCEL_GIT_REPO_OWNER;
const repoSlug = process.env.NEXT_PUBLIC_VERCEL_GIT_REPO_SLUG;
const commitRef = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF;

export const UPSTREAM_SOURCE_URL = 'https://github.com/lingdojo/kana-dojo';

const vercelSourceUrl =
  repoOwner && repoSlug
    ? `https://github.com/${repoOwner}/${repoSlug}${commitRef ? `/tree/${commitRef}` : ''}`
    : undefined;

export const SOURCE_CODE_URL =
  process.env.NEXT_PUBLIC_SOURCE_URL || vercelSourceUrl || UPSTREAM_SOURCE_URL;
