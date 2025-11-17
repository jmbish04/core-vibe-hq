import { defineConfig, configDefaults } from "vitest/config";

export default defineConfig({
	test: {
		passWithNoTests: true,
		exclude: [...configDefaults.exclude, "**/smoke/**"],
	},
});
