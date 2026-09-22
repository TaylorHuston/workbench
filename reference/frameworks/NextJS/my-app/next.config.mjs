/** @type {import('next').NextConfig} */
const nextConfig = {
  // better-sqlite3 is a native Node.js package. Keep it external to the server
  // bundle so Next does not try to compile it into browser-facing code.
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
