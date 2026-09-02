import { loadEnvFile } from 'node:process';
import { defineConfig } from 'vitest/config';
import { MastraEvalsReporter } from '@mastra/evals/vitest';

loadEnvFile('.env');

export default defineConfig({
  test: {
    include: ['src/**/*.eval.ts'],
    reporters: ['default', new MastraEvalsReporter()],
    setupFiles: ['@mastra/evals/vitest/setup'],
    fileParallelism: false,
  },
});
