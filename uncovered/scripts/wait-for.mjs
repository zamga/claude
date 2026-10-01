/*
 * Wait until an address answers, then exit: lets one test server start only
 * after another has finished the build both depend on.
 */
const url = process.argv[2];
const deadline = Date.now() + Number(process.argv[3] ?? 240_000);
while (Date.now() < deadline) {
  try {
    const res = await fetch(url);
    if (res.ok) process.exit(0);
  } catch {
    // Not up yet.
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
}
console.error(`${url} did not answer in time`);
process.exit(1);
