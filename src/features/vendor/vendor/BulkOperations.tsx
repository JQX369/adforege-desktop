'use client'

import { useState, useRef } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/ui/card'
import { Button } from '@/src/ui/button'
import { Input } from '@/src/ui/input'
import { Textarea } from '@/src/ui/textarea'
import { Label } from '@/src/ui/label'
import { Progress } from '@/src/ui/progress'
import { Alert, AlertDescription } from '@/src/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/ui/tabs'
import { Checkbox } from '@/src/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/ui/select'
import {
  Upload,
  Download,
  Trash2,
  Edit,
  Copy,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileText,
  Image,
  Link,
  Settings,
  Zap,
} from 'lucide-react'

interface BulkOperationsProps {
  vendorId: string
}

interface BulkOperationResult {
  success: boolean
  message: string
  details?: any
  errors?: string[]
}

interface ProductData {
  title: string
  description: string
  price: number
  currency: string
  category: string
  tags: string[]
  imageUrl: string
  affiliateUrl: string
}

export function BulkOperations({ vendorId }: BulkOperationsProps) {
  const [activeTab, setActiveTab] = useState('upload')
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState<BulkOperationResult[]>([])
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Upload states
  const [csvData, setCsvData] = useState('')
  const [urls, setUrls] = useState('')
  const [bulkEditData, setBulkEditData] = useState<Partial<ProductData>>({})

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsProcessing(true)
    setProgress(0)
    setResults([])

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('vendorId', vendorId)

      const response = await fetch('/api/vendor/bulk/upload', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (response.ok) {
        setResults([
          {
            success: true,
            message: `Successfully uploaded ${result.count} products`,
            details: result,
          },
        ])
      } else {
        setResults([
          {
            success: false,
            message: result.error || 'Upload failed',
            errors: result.errors,
          },
        ])
      }
    } catch (error) {
      setResults([
        {
          success: false,
          message: 'Upload failed',
          errors: [error instanceof Error ? error.message : 'Unknown error'],
        },
      ])
    } finally {
      setIsProcessing(false)
      setProgress(100)
    }
  }

  const handleCsvUpload = async () => {
    if (!csvData.trim()) return

    setIsProcessing(true)
    setProgress(0)
    setResults([])

    try {
      const response = await fetch('/api/vendor/bulk/csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvData, vendorId }),
      })

      const result = await response.json()

      if (response.ok) {
        setResults([
          {
            success: true,
            message: `Successfully processed ${result.count} products`,
            details: result,
          },
        ])
      } else {
        setResults([
          {
            success: false,
            message: result.error || 'CSV processing failed',
            errors: result.errors,
          },
        ])
      }
    } catch (error) {
      setResults([
        {
          success: false,
          message: 'CSV processing failed',
          errors: [error instanceof Error ? error.message : 'Unknown error'],
        },
      ])
    } finally {
      setIsProcessing(false)
      setProgress(100)
    }
  }

  const handleUrlIngestion = async () => {
    if (!urls.trim()) return

    setIsProcessing(true)
    setProgress(0)
    setResults([])

    try {
      const urlList = urls
        .split('\n')
        .map((url) => url.trim())
        .filter(Boolean)

      const response = await fetch('/api/vendor/bulk/urls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: urlList, vendorId }),
      })

      const result = await response.json()

      if (response.ok) {
        setResults([
          {
            success: true,
            message: `Successfully ingested ${result.count} products`,
            details: result,
          },
        ])
      } else {
        setResults([
          {
            success: false,
            message: result.error || 'URL ingestion failed',
            errors: result.errors,
          },
        ])
      }
    } catch (error) {
      setResults([
        {
          success: false,
          message: 'URL ingestion failed',
          errors: [error instanceof Error ? error.message : 'Unknown error'],
        },
      ])
    } finally {
      setIsProcessing(false)
      setProgress(100)
    }
  }

  const handleBulkEdit = async () => {
    if (selectedProducts.length === 0) return

    setIsProcessing(true)
    setProgress(0)
    setResults([])

    try {
      const response = await fetch('/api/vendor/bulk/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productIds: selectedProducts,
          updates: bulkEditData,
          vendorId,
        }),
      })

      const result = await response.json()

      if (response.ok) {
        setResults([
          {
            success: true,
            message: `Successfully updated ${result.count} products`,
            details: result,
          },
        ])
        setSelectedProducts([])
        setBulkEditData({})
      } else {
        setResults([
          {
            success: false,
            message: result.error || 'Bulk edit failed',
            errors: result.errors,
          },
        ])
      }
    } catch (error) {
      setResults([
        {
          success: false,
          message: 'Bulk edit failed',
          errors: [error instanceof Error ? error.message : 'Unknown error'],
        },
      ])
    } finally {
      setIsProcessing(false)
      setProgress(100)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedProducts.length === 0) return

    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedProducts.length} products? This action cannot be undone.`
    )
    if (!confirmed) return

    setIsProcessing(true)
    setProgress(0)
    setResults([])

    try {
      const response = await fetch('/api/vendor/bulk/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds: selectedProducts, vendorId }),
      })

      const result = await response.json()

      if (response.ok) {
        setResults([
          {
            success: true,
            message: `Successfully deleted ${result.count} products`,
            details: result,
          },
        ])
        setSelectedProducts([])
      } else {
        setResults([
          {
            success: false,
            message: result.error || 'Bulk delete failed',
            errors: result.errors,
          },
        ])
      }
    } catch (error) {
      setResults([
        {
          success: false,
          message: 'Bulk delete failed',
          errors: [error instanceof Error ? error.message : 'Unknown error'],
        },
      ])
    } finally {
      setIsProcessing(false)
      setProgress(100)
    }
  }

  const downloadTemplate = () => {
    const csvContent =
      'title,description,price,currency,category,tags,imageUrl,affiliateUrl\n' +
      'Sample Product,This is a sample product description,29.99,USD,Electronics,"electronics,gadgets",https://example.com/image.jpg,https://example.com/product'

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'product-template.csv'
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Bulk Operations</h2>
          <p className="text-muted-foreground">
            Manage multiple products efficiently
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-2" />
            Template
          </Button>
        </div>
      </div>

      {/* Progress Bar */}
      {isProcessing && (
        <Card>
          <CardContent className="p-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Processing...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-2">
          {results.map((result, index) => (
            <Alert
              key={index}
              variant={result.success ? 'default' : 'destructive'}
            >
              <div className="flex items-center">
                {result.success ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                <AlertDescription className="ml-2">
                  {result.message}
                  {result.errors && result.errors.length > 0 && (
                    <div className="mt-2 text-sm">
                      <strong>Errors:</strong>
                      <ul className="list-disc list-inside mt-1">
                        {result.errors.map((error, i) => (
                          <li key={i}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </AlertDescription>
              </div>
            </Alert>
          ))}
        </div>
      )}

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <TabsList>
          <TabsTrigger value="upload">File Upload</TabsTrigger>
          <TabsTrigger value="csv">CSV Data</TabsTrigger>
          <TabsTrigger value="urls">URL Ingestion</TabsTrigger>
          <TabsTrigger value="edit">Bulk Edit</TabsTrigger>
          <TabsTrigger value="delete">Bulk Delete</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                File Upload
              </CardTitle>
              <CardDescription>
                Upload a CSV file with your product data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p className="text-sm text-gray-600 mb-4">
                  Drag and drop your CSV file here, or click to browse
                </p>
                <Button onClick={() => fileInputRef.current?.click()}>
                  Choose File
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
              <div className="text-sm text-muted-foreground">
                <p>
                  <strong>Supported formats:</strong> CSV (.csv)
                </p>
                <p>
                  <strong>Required columns:</strong> title, description, price,
                  currency, category
                </p>
                <p>
                  <strong>Optional columns:</strong> tags, imageUrl,
                  affiliateUrl
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="csv" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                CSV Data
              </CardTitle>
              <CardDescription>
                Paste CSV data directly into the text area
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="csv-data">CSV Data</Label>
                <Textarea
                  id="csv-data"
                  placeholder="title,description,price,currency,category&#10;Product 1,Description 1,29.99,USD,Electronics&#10;Product 2,Description 2,19.99,USD,Books"
                  value={csvData}
                  onChange={(e) => setCsvData(e.target.value)}
                  className="min-h-[200px] font-mono text-sm"
                />
              </div>
              <Button
                onClick={handleCsvUpload}
                disabled={!csvData.trim() || isProcessing}
              >
                <Zap className="h-4 w-4 mr-2" />
                Process CSV Data
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="urls" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link className="h-5 w-5" />
                URL Ingestion
              </CardTitle>
              <CardDescription>
                Ingest products from product URLs (one per line)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="urls">Product URLs</Label>
                <Textarea
                  id="urls"
                  placeholder="https://www.amazon.com/dp/B0...&#10;https://www.etsy.com/listing/...&#10;https://www.ebay.com/itm/..."
                  value={urls}
                  onChange={(e) => setUrls(e.target.value)}
                  className="min-h-[200px] font-mono text-sm"
                />
              </div>
              <Button
                onClick={handleUrlIngestion}
                disabled={!urls.trim() || isProcessing}
              >
                <Zap className="h-4 w-4 mr-2" />
                Ingest URLs
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="edit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Edit className="h-5 w-5" />
                Bulk Edit
              </CardTitle>
              <CardDescription>Edit multiple products at once</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Select products from your product list first, then use this
                  form to apply changes to all selected products.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bulk-title">Title</Label>
                  <Input
                    id="bulk-title"
                    placeholder="New title for all products"
                    value={bulkEditData.title || ''}
                    onChange={(e) =>
                      setBulkEditData({
                        ...bulkEditData,
                        title: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bulk-price">Price</Label>
                  <Input
                    id="bulk-price"
                    type="number"
                    step="0.01"
                    placeholder="New price"
                    value={bulkEditData.price || ''}
                    onChange={(e) =>
                      setBulkEditData({
                        ...bulkEditData,
                        price: parseFloat(e.target.value),
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bulk-currency">Currency</Label>
                  <Select
                    value={bulkEditData.currency || ''}
                    onValueChange={(value) =>
                      setBulkEditData({ ...bulkEditData, currency: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bulk-category">Category</Label>
                  <Input
                    id="bulk-category"
                    placeholder="New category"
                    value={bulkEditData.category || ''}
                    onChange={(e) =>
                      setBulkEditData({
                        ...bulkEditData,
                        category: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bulk-description">Description</Label>
                <Textarea
                  id="bulk-description"
                  placeholder="New description for all products"
                  value={bulkEditData.description || ''}
                  onChange={(e) =>
                    setBulkEditData({
                      ...bulkEditData,
                      description: e.target.value,
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bulk-tags">Tags (comma-separated)</Label>
                <Input
                  id="bulk-tags"
                  placeholder="tag1, tag2, tag3"
                  value={bulkEditData.tags?.join(', ') || ''}
                  onChange={(e) =>
                    setBulkEditData({
                      ...bulkEditData,
                      tags: e.target.value
                        .split(',')
                        .map((tag) => tag.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </div>

              <Button
                onClick={handleBulkEdit}
                disabled={selectedProducts.length === 0 || isProcessing}
                className="w-full"
              >
                <Edit className="h-4 w-4 mr-2" />
                Update {selectedProducts.length} Products
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="delete" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trash2 className="h-5 w-5" />
                Bulk Delete
              </CardTitle>
              <CardDescription>
                Delete multiple products at once
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  This action cannot be undone. Make sure you have selected the
                  correct products.
                </AlertDescription>
              </Alert>

              <Button
                onClick={handleBulkDelete}
                disabled={selectedProducts.length === 0 || isProcessing}
                variant="destructive"
                className="w-full"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete {selectedProducts.length} Products
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
