/** Parses req[source] with a zod schema and replaces it with the parsed value. */
export const validate = (schema, source = 'body') => (req, res, next) => {
  const parsed = schema.parse(req[source] ?? {});
  // req.query is a getter in Express 5, so parsed queries are stored separately.
  if (source === 'query') req.validQuery = parsed;
  else req[source] = parsed;
  next();
};
