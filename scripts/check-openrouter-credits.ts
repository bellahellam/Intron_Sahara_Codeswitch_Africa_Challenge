import "./env";
async function main() {
  const res = await fetch("https://openrouter.ai/api/v1/key", {
    headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
  });
  console.log("HTTP", res.status);
  console.log(JSON.stringify(await res.json(), null, 2));
}
main();
