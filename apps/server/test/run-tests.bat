set HTTPS_PROXY=http://127.0.0.1:7890
set HTTP_PROXY=http://127.0.0.1:7890
set "GLOBAL_AGENT.HTTP_PROXY=http://127.0.0.1:7890"
set "GLOBAL_AGENT.HTTPS_PROXY=http://127.0.0.1:7890"
npx tsx test/source-connectivity.test.ts
