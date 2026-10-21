// Fields are limited to primitives so error objects, requests and query
// results cannot be logged wholesale by accident.
type LogFields = Record<string, string | number | boolean | undefined>;

export type Logger = {
  info(event: string, fields?: LogFields): void;
  error(event: string, fields?: LogFields): void;
};

function write(
  stream: NodeJS.WriteStream,
  level: "info" | "error",
  event: string,
  fields: LogFields = {},
) {
  const entry = { time: new Date().toISOString(), level, event, ...fields };
  stream.write(`${JSON.stringify(entry)}\n`);
}

export const logger: Logger = {
  info: (event, fields) => write(process.stdout, "info", event, fields),
  error: (event, fields) => write(process.stderr, "error", event, fields),
};
