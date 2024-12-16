<img src="https://www.pensarai.com/logo.svg" alt="LOGO" width="300"/>

# Pensar Scan GitHub Action

The **Pensar Scan GitHub Action** integrates your repository with [Pensar Console](https://console.pensar.dev). Automatically scan and generate patches for found vulnerabilities when commits are pushed or PRs are opened.

## 🚀 Getting Started

### 1. Connect Your Repository

To begin using Pensar Scan:

1. Go to [Pensar Console](https://console.pensar.dev).
2. Connect your repository to integrate scans.
3. Add the `PENSAR_API_KEY` to your repository secrets within Console or manually

### 2. Add the GitHub Action

Utilize our setup wizard or add the following configuration to your repository's `.github/workflows/pensar-scan.yml` file:

```yaml
name: Pensar Vulnerability Scan

on:
  push:
    branches:
      - main
  pull_request:

jobs:
  scan:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout Code
        uses: actions/checkout@v3

      - name: Run Pensar Scan
        uses: pensarai/pensar-scan@v1
        with:
          api-key: ${{ secrets.PENSAR_API_KEY }}
```

## 📊 Viewing Scan Results

- Once the action runs, suggested patches will be added to PRs as comments. Issues will also be displayed in the Console UI for more information.
- If issues are found, the Action run will fail.

## 🙋‍♂️ Support

Need help? Check out our [documentation](https://docs.pensar.dev)

## 💡 Tips

- Use branch protection rules to enforce scans on all pull requests.
- Regularly update the GitHub Action to use the latest version for enhanced features and security.

## 🛡 About Pensar

Pensar is dedicated to empowering developers with cutting-edge tools for secure and efficient software development. Visit us at [pensar.dev](https://pensarai.com) to learn more.
