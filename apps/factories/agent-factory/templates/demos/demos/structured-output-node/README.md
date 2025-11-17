# Structured Output

This project is designed to test the structured output of a local development server. The key element here is that it uses the user's account credentials instead of an API key. This is a significant change from the previous version, which relied on an API key for authentication.

## Table of Contents
1. [Overview](#overview)
2. [Usage](#usage)
3. [Architecture](#architecture)

## Overview
The purpose of this project is to validate the structured output of a local development server. It uses integration tests to ensure that the server returns JSON objects that match a predefined schema. The project is built using Vitest for testing and Zod for schema validation.

## Usage
To start the project locally and run the integration tests, use the following command:

```bash
npx nx test structured-output
```

### NPM Scripts
- **test**: Runs the integration tests to validate the server's structured output.

### API Interaction
The project interacts with a local development server API. Below is the API call used in the tests:

- **Endpoint**: `/`
- **Method**: `POST`
- **Request Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "prompt": "Create a recipe for sourdough bread."
  }
  ```
- **Response Format**:
  ```json
  {
    "recipe": {
      "name": "string",
      "ingredients": [
        { "name": "string", "amount": "string" }
      ],
      "steps": ["string"]
    }
  }
  ```
- **Curl Command**:
  ```bash
  curl -X POST \
    -H "Content-Type: application/json" \
    -d '{"prompt": "Create a recipe for sourdough bread."}' \
    http://localhost:3000/
  ```

## Architecture
The project is structured as an application that tests the output of a local server. It uses the following components:

- **DevServerTestHelper**: A utility to start and stop the local development server.
- **Integration Tests**: Tests that validate the server's response against a predefined schema using Zod.

### System Diagram
```mermaid
graph TD;
    A[Client] -->|POST Request| B[Local Dev Server];
    B -->|Response| C[Integration Test];
    C -->|Validation| D[Schema (Zod)];
    D -->|Result| E[Test Outcome];
```

This project does not use LLMs or AI, so no agentic patterns are highlighted.

<!-- Last updated: 0308b1a3da967e903a9ef2c03aa3e4608ce199e9 -->
