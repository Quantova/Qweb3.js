/// test.js
const fs = require('fs');
const path = require('path');

// Test-only: route axios through the global mock handler a suite installs (keeps prod transport clean).
const axios = require('axios');
const _qweb3OrigAdapter = axios.defaults.adapter;
axios.defaults.adapter = async (config) => {
  if (typeof global.__AXIOS_HANDLER__ === 'function') {
    // axios serializes the body to a JSON string before the adapter; hand the mock the
    // parsed payload it expects (array for a batch, object for a single request).
    let data = config.data;
    if (typeof data === 'string') { try { data = JSON.parse(data); } catch (e) { /* leave as-is */ } }
    const r = await global.__AXIOS_HANDLER__({ ...config, data });
    return { data: r && r.data, status: 200, statusText: 'OK', headers: {}, config };
  }
  return _qweb3OrigAdapter(config);
};

console.log("====================================================");
console.log("      Quantova Enterprise SDK Global Test Suite     ");
console.log("====================================================\n");

const testsDir = path.join(__dirname, 'tests');
const testFiles = fs.readdirSync(testsDir).filter(file => file.endsWith('.test.js')).sort();

(async () => {
  let successCount = 0;
  let failureCount = 0;

  for (const file of testFiles) {
    try {
      const testPath = path.join(testsDir, file);
      const testModule = require(testPath);
      if (typeof testModule.run === 'function') {
        await testModule.run(); // supports sync and async suites
        successCount++;
      }
    } catch (err) {
      console.error(`\u2717 Test suite "${file}" failed:`, err && err.message ? err.message : err);
      failureCount++;
    }
  }

  console.log("\n====================================================");
  console.log(`  Tests Execution Summary:`);
  console.log(`  - Total Suites Run:  ${successCount + failureCount}`);
  console.log(`  - Passed Suites:     ${successCount}`);
  console.log(`  - Failed Suites:     ${failureCount}`);
  console.log("====================================================");
  if (failureCount === 0) {
    console.log("\u2705 ALL TEST SUITES PASSED.");
    process.exit(0);
  } else {
    console.log("\u274c SOME TEST SUITES FAILED.");
    process.exit(1);
  }
})();
