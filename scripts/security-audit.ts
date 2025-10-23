#!/usr/bin/env tsx

import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

interface SecurityIssue {
  file: string
  line: number
  severity: 'high' | 'medium' | 'low'
  issue: string
  recommendation: string
}

class SecurityAuditor {
  private issues: SecurityIssue[] = []
  private readonly projectRoot: string

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot
  }

  async audit(): Promise<void> {
    console.log('🔒 Starting security audit...\n')

    await this.checkEnvironmentVariables()
    await this.checkDependencies()
    await this.checkApiRoutes()
    await this.checkMiddleware()
    await this.checkValidation()
    await this.checkSecrets()

    this.printReport()
  }

  private async checkEnvironmentVariables(): Promise<void> {
    console.log('📋 Checking environment variables...')

    const envFile = join(this.projectRoot, '.env.local')
    if (existsSync(envFile)) {
      const content = readFileSync(envFile, 'utf-8')

      // Check for hardcoded secrets
      if (content.includes('sk-') && content.includes('OPENAI_API_KEY')) {
        this.addIssue(
          '.env.local',
          0,
          'medium',
          'OpenAI API key found in .env.local',
          'Ensure .env.local is in .gitignore and not committed'
        )
      }

      // Check for weak secrets
      const weakSecrets = content.match(/=\s*['"]?[a-zA-Z0-9]{1,7}['"]?/g)
      if (weakSecrets) {
        this.addIssue(
          '.env.local',
          0,
          'high',
          'Weak secrets detected',
          'Use strong, randomly generated secrets with at least 32 characters'
        )
      }
    }
  }

  private async checkDependencies(): Promise<void> {
    console.log('📦 Checking dependencies...')

    const packageJson = join(this.projectRoot, 'package.json')
    if (existsSync(packageJson)) {
      const content = JSON.parse(readFileSync(packageJson, 'utf-8'))
      const dependencies = {
        ...content.dependencies,
        ...content.devDependencies,
      }

      // Check for known vulnerable packages
      const vulnerablePackages = [
        'lodash',
        'express',
        'moment',
        'jquery',
        'angular',
      ]

      for (const pkg of vulnerablePackages) {
        if (dependencies[pkg]) {
          this.addIssue(
            'package.json',
            0,
            'medium',
            `Potentially vulnerable package: ${pkg}`,
            'Check for security updates and consider alternatives'
          )
        }
      }
    }
  }

  private async checkApiRoutes(): Promise<void> {
    console.log('🛡️ Checking API routes...')

    const apiDir = join(this.projectRoot, 'app/api')
    if (existsSync(apiDir)) {
      const files = this.getFilesRecursively(apiDir, '.ts')

      for (const file of files) {
        const content = readFileSync(file, 'utf-8')
        const lines = content.split('\n')

        lines.forEach((line, index) => {
          // Check for SQL injection vulnerabilities
          if (line.includes('$queryRaw') && !line.includes('prisma')) {
            this.addIssue(
              file,
              index + 1,
              'high',
              'Raw SQL query detected',
              'Use Prisma ORM methods instead of raw SQL'
            )
          }

          // Check for XSS vulnerabilities
          if (
            line.includes('dangerouslySetInnerHTML') &&
            !line.includes('sanitize')
          ) {
            this.addIssue(
              file,
              index + 1,
              'high',
              'Unsanitized HTML injection',
              'Sanitize HTML content before rendering'
            )
          }

          // Check for missing input validation
          if (
            line.includes('request.json()') &&
            !content.includes('validateInput')
          ) {
            this.addIssue(
              file,
              index + 1,
              'medium',
              'Missing input validation',
              'Add input validation for all user inputs'
            )
          }

          // Check for missing rate limiting
          if (
            line.includes('export async function POST') &&
            !content.includes('rateLimit')
          ) {
            this.addIssue(
              file,
              index + 1,
              'medium',
              'Missing rate limiting',
              'Implement rate limiting for API endpoints'
            )
          }
        })
      }
    }
  }

  private async checkMiddleware(): Promise<void> {
    console.log('🔧 Checking middleware...')

    const middlewareFile = join(this.projectRoot, 'middleware.ts')
    if (existsSync(middlewareFile)) {
      const content = readFileSync(middlewareFile, 'utf-8')
      const lines = content.split('\n')

      lines.forEach((line, index) => {
        // Check for security headers
        if (!content.includes('X-Frame-Options')) {
          this.addIssue(
            middlewareFile,
            index + 1,
            'medium',
            'Missing X-Frame-Options header',
            'Add X-Frame-Options header to prevent clickjacking'
          )
        }

        if (!content.includes('X-Content-Type-Options')) {
          this.addIssue(
            middlewareFile,
            index + 1,
            'medium',
            'Missing X-Content-Type-Options header',
            'Add X-Content-Type-Options header to prevent MIME sniffing'
          )
        }

        if (!content.includes('Content-Security-Policy')) {
          this.addIssue(
            middlewareFile,
            index + 1,
            'high',
            'Missing Content Security Policy',
            'Implement CSP to prevent XSS attacks'
          )
        }
      })
    }
  }

  private async checkValidation(): Promise<void> {
    console.log('✅ Checking validation...')

    const validationFile = join(this.projectRoot, 'lib/validation.ts')
    if (existsSync(validationFile)) {
      const content = readFileSync(validationFile, 'utf-8')

      if (!content.includes('sanitizeString')) {
        this.addIssue(
          validationFile,
          0,
          'medium',
          'Missing string sanitization',
          'Implement string sanitization functions'
        )
      }

      if (!content.includes('escapeHtml')) {
        this.addIssue(
          validationFile,
          0,
          'high',
          'Missing HTML escaping',
          'Implement HTML escaping to prevent XSS'
        )
      }
    }
  }

  private async checkSecrets(): Promise<void> {
    console.log('🔐 Checking for exposed secrets...')

    const files = this.getFilesRecursively(this.projectRoot, [
      '.ts',
      '.js',
      '.tsx',
      '.jsx',
    ])

    for (const file of files) {
      const content = readFileSync(file, 'utf-8')
      const lines = content.split('\n')

      lines.forEach((line, index) => {
        // Check for hardcoded API keys
        if (line.match(/['"]sk-[a-zA-Z0-9]{20,}['"]/)) {
          this.addIssue(
            file,
            index + 1,
            'high',
            'Hardcoded API key detected',
            'Move API keys to environment variables'
          )
        }

        // Check for hardcoded passwords
        if (line.match(/password\s*[:=]\s*['"][^'"]{3,}['"]/i)) {
          this.addIssue(
            file,
            index + 1,
            'high',
            'Hardcoded password detected',
            'Use environment variables for passwords'
          )
        }

        // Check for console.log with sensitive data
        if (
          line.includes('console.log') &&
          (line.includes('password') ||
            line.includes('token') ||
            line.includes('key'))
        ) {
          this.addIssue(
            file,
            index + 1,
            'medium',
            'Sensitive data in console.log',
            'Remove or sanitize sensitive data from logs'
          )
        }
      })
    }
  }

  private addIssue(
    file: string,
    line: number,
    severity: 'high' | 'medium' | 'low',
    issue: string,
    recommendation: string
  ): void {
    this.issues.push({
      file: file.replace(this.projectRoot, '.'),
      line,
      severity,
      issue,
      recommendation,
    })
  }

  private getFilesRecursively(
    dir: string,
    extensions: string | string[]
  ): string[] {
    const files: string[] = []
    const extArray = Array.isArray(extensions) ? extensions : [extensions]

    try {
      const fs = require('fs')
      const path = require('path')

      const items = fs.readdirSync(dir)

      for (const item of items) {
        const fullPath = path.join(dir, item)
        const stat = fs.statSync(fullPath)

        if (
          stat.isDirectory() &&
          !item.startsWith('.') &&
          item !== 'node_modules'
        ) {
          files.push(...this.getFilesRecursively(fullPath, extensions))
        } else if (
          stat.isFile() &&
          extArray.some((ext) => item.endsWith(ext))
        ) {
          files.push(fullPath)
        }
      }
    } catch (error) {
      // Ignore permission errors
    }

    return files
  }

  private printReport(): void {
    console.log('\n📊 Security Audit Report')
    console.log('='.repeat(50))

    if (this.issues.length === 0) {
      console.log('✅ No security issues found!')
      return
    }

    const highIssues = this.issues.filter((i) => i.severity === 'high')
    const mediumIssues = this.issues.filter((i) => i.severity === 'medium')
    const lowIssues = this.issues.filter((i) => i.severity === 'low')

    console.log(`\n🔴 High Priority Issues: ${highIssues.length}`)
    highIssues.forEach((issue) => {
      console.log(`  ${issue.file}:${issue.line} - ${issue.issue}`)
      console.log(`    💡 ${issue.recommendation}\n`)
    })

    console.log(`\n🟡 Medium Priority Issues: ${mediumIssues.length}`)
    mediumIssues.forEach((issue) => {
      console.log(`  ${issue.file}:${issue.line} - ${issue.issue}`)
      console.log(`    💡 ${issue.recommendation}\n`)
    })

    console.log(`\n🟢 Low Priority Issues: ${lowIssues.length}`)
    lowIssues.forEach((issue) => {
      console.log(`  ${issue.file}:${issue.line} - ${issue.issue}`)
      console.log(`    💡 ${issue.recommendation}\n`)
    })

    console.log(`\n📈 Summary:`)
    console.log(`  Total Issues: ${this.issues.length}`)
    console.log(`  High Priority: ${highIssues.length}`)
    console.log(`  Medium Priority: ${mediumIssues.length}`)
    console.log(`  Low Priority: ${lowIssues.length}`)

    if (highIssues.length > 0) {
      console.log(
        '\n⚠️  Please address high priority issues before deployment!'
      )
    }
  }
}

// Run the audit
async function main() {
  const auditor = new SecurityAuditor(process.cwd())
  await auditor.audit()
}

if (require.main === module) {
  main().catch(console.error)
}

export { SecurityAuditor }
