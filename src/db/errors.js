const UNIQUE_VIOLATION = "23505";

function isUniqueViolationOn(error, column) {
  return (
    String(error?.code) === UNIQUE_VIOLATION &&
    new RegExp(column, "i").test(`${error?.constraint || ""} ${error?.detail || ""}`)
  );
}

function isDatabaseConnectionError(error) {
  return (
    ["28P01", "3D000", "57P01", "ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "ECONNRESET"].includes(
      String(error?.code || "")
    ) || /connection terminated|timeout|password authentication failed|database .* does not exist/i.test(
      String(error?.message || "")
    )
  );
}

module.exports = {
  isDatabaseConnectionError,
  isUniqueViolationOn
};
