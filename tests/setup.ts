// Runs before each test file.

// A fixed time zone, so date results don't depend on where the tests run.
// Tests that need another zone use inTimeZone() from ./helpers.
process.env.TZ = "America/Chicago";

// Some code reads location.host (e.g. calendar event IDs)
globalThis.location = { host: "example.com" } as Location;
