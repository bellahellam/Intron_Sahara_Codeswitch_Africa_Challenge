/** One-off: list currently available free OpenRouter models, so the default is chosen from
 *  reality rather than from memory. Model ids churn; hardcoding one is how you get a 404. */
import "./env";

async function main() {
  const res = await fetch("https://openrouter.ai/api/v1/models", {
    headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
  });
  const json = (await res.json()) as {
    data: Array<{
      id: string;
      name: string;
      context_length: number;
      pricing: { prompt: string; completion: string };
      supported_parameters?: string[];
    }>;
  };
  const free = json.data
    .filter((m) => Number(m.pricing.prompt) === 0 && Number(m.pricing.completion) === 0)
    .sort((a, b) => b.context_length - a.context_length);

  console.log(`${free.length} free models\n`);
  for (const m of free.slice(0, 30)) {
    const params = m.supported_parameters ?? [];
    const structured = params.includes("structured_outputs")
      ? "json_schema"
      : params.includes("response_format")
        ? "json_object"
        : "-";
    console.log(`${m.id.padEnd(46)} ctx=${String(m.context_length).padStart(7)}  ${structured}`);
  }
}
main();
