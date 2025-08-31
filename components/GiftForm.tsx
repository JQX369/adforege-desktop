'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { GiftFormData } from '@/prompts/GiftPrompt'
import { detectGeoFromBrowser, getCurrencySymbol } from '@/lib/geo'

interface GiftFormProps {
  onSubmit: (data: GiftFormData) => void
  isLoading?: boolean
  onProgressChange?: (progress: number) => void
  onGenderChange?: (gender: string | undefined) => void
}

// Base single-question steps and which are multi-select
const BASE_STEP_DEFS = [
  { key: 'relationship', label: 'Relationship to Recipient', type: 'radio', options: ['Parent','Sibling','Partner','Friend','Colleague','Child','Other'] },
  { key: 'ageRange', label: 'Age Range', type: 'radio', options: ['Under 5','5-7','8-10','11-13','14-17','18-25','26-35','36-45','46-55','56-65','Over 65'] },
  { key: 'gender', label: 'Gender', type: 'radio', options: ['Male','Female','Non-binary','Prefer not to say'] },
  { key: 'occasion', label: 'Occasion', type: 'radio', options: ['Birthday','Christmas','Anniversary','Valentine\'s Day','Mother\'s Day','Father\'s Day','Graduation','Wedding','Baby Shower','Housewarming','Just Because','Other'] },
  { key: 'budget', label: 'Budget Range', type: 'radio', options: [] }, // Will be populated dynamically
  { key: 'personality', label: 'Personality Type', type: 'radio', options: ['Adventurous','Creative','Practical','Intellectual','Social','Introverted','Luxury-loving','Minimalist'] },
  { key: 'giftType', label: 'Gift Preference', type: 'radio', options: ['Experiences','Physical Items','Subscriptions','Gift Cards','Donations','No Preference'] },
  { key: 'interests', label: 'Primary Interests (Select up to 3)', type: 'multi', options: ['Technology','Sports','Reading','Cooking','Gaming','Fashion','Art','Music','Travel','Fitness','Gardening','Photography','Outdoors'] },
  // Renamed from "Special Requirements" to location-based prompt
  { key: 'location', label: 'Find near them', type: 'text' },
]

function reorderWithPriority(options: string[], priorityInOrder: string[]): string[] {
  const set = new Set(options)
  const prioritized = priorityInOrder.filter(o => set.has(o))
  const rest = options.filter(o => !priorityInOrder.includes(o))
  return [...prioritized, ...rest]
}

export function computeFilteredStepDefs(formData: Partial<GiftFormData>, budgetOptions: string[]) {
  const relationship = (formData.relationship || '').toLowerCase()
  const gender = (formData.gender || '').toLowerCase()
  const ageRange = formData.ageRange || ''
  const giftType = formData.giftType || ''

  const childAges = ['Under 5','5-7','8-10','11-13','14-17']
  const adultAges = ['18-25','26-35','36-45','46-55','56-65','Over 65']
  const isChildAge = childAges.includes(ageRange)

  const kidFriendlyInterests = ['Sports','Reading','Gaming','Art','Music']
  const experiencesPriorityInterests = ['Travel','Fitness','Cooking','Art','Music']

  return BASE_STEP_DEFS.map(def => {
    if (def.key === 'budget') {
      return { ...def, options: budgetOptions }
    }
    if (def.key === 'ageRange') {
      // Example flows:
      // - If relationship is Parent: age ranges should be adults only
      // - If relationship is Child: show only child age ranges
      if (relationship === 'parent') {
        return { ...def, options: adultAges }
      }
      if (relationship === 'child') {
        return { ...def, options: childAges }
      }
      return def
    }
    if (def.key === 'occasion') {
      let options = [...(def.options || [])]
      // If Parent + Female, remove Father's Day
      if (relationship === 'parent' && gender === 'female') {
        options = options.filter(o => o !== "Father's Day")
      }
      // If Parent + Male, remove Mother's Day
      if (relationship === 'parent' && gender === 'male') {
        options = options.filter(o => o !== "Mother's Day")
      }
      // If Partner: remove Mother's/Father's Day and surface Anniversary/Valentine's Day
      if (relationship === 'partner') {
        options = options.filter(o => o !== "Mother's Day" && o !== "Father's Day")
        options = reorderWithPriority(options, ['Anniversary', "Valentine's Day"]) 
      }
      return { ...def, options }
    }
    if (def.key === 'interests') {
      let options = [...(def.options || [])]
      if (isChildAge) {
        options = options.filter(o => kidFriendlyInterests.includes(o))
      }
      if (giftType === 'Experiences') {
        options = reorderWithPriority(options, experiencesPriorityInterests)
      }
      return { ...def, options }
    }
    if (def.key === 'avoid') {
      let options = [...(def.options || [])]
      if (giftType === 'Experiences') {
        const avoidPriority = ['Clothing','Electronics','Jewelry','Home Decor','Beauty Products','Books','Food/Drink']
        options = reorderWithPriority(options, avoidPriority)
      }
      return { ...def, options }
    }
    return def
  })
}

export function GiftForm({ onSubmit, isLoading = false, onProgressChange, onGenderChange }: GiftFormProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [currencySymbol, setCurrencySymbol] = useState('$')
  const [formData, setFormData] = useState<Partial<GiftFormData>>({
    interests: [],
    avoid: [],
  })
  const [locationQuery, setLocationQuery] = useState('')
  const [locationSuggestions, setLocationSuggestions] = useState<string[]>([])
  const locationDebounceRef = useRef<number | null>(null)

  // Detect user's currency on mount
  useEffect(() => {
    const geo = detectGeoFromBrowser()
    setCurrencySymbol(getCurrencySymbol(geo.currency))
  }, [])

  // Debounced fetch for location suggestions (uses OpenStreetMap Nominatim anonymously)
  useEffect(() => {
    if (locationDebounceRef.current) {
      window.clearTimeout(locationDebounceRef.current)
    }
    const q = locationQuery.trim()
    if (q.length < 3) {
      setLocationSuggestions([])
      return
    }
    locationDebounceRef.current = window.setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&addressdetails=0&limit=5`
        const res = await fetch(url, { headers: { 'Accept': 'application/json' } })
        if (!res.ok) return setLocationSuggestions([])
        const data: any[] = await res.json()
        const suggestions = (data || []).map((item) => item.display_name).filter(Boolean)
        setLocationSuggestions(suggestions)
      } catch {
        setLocationSuggestions([])
      }
    }, 250)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationQuery])

  // Dynamic budget options based on currency
  const budgetOptions = useMemo(() => {
    return [
      `Under ${currencySymbol}25`,
      `${currencySymbol}25-50`,
      `${currencySymbol}50-100`,
      `${currencySymbol}100-200`,
      `${currencySymbol}200-500`,
      `Over ${currencySymbol}500`
    ]
  }, [currencySymbol])

  // Compute filtered steps based on current answers
  const dynamicStepDefs = useMemo(() => {
    return computeFilteredStepDefs(formData, budgetOptions)
  }, [formData, budgetOptions])

  const TOTAL_STEPS = dynamicStepDefs.length
  const progressWidthClass = useMemo(() => {
    const widths = [
      'w-1/12','w-2/12','w-3/12','w-4/12','w-5/12','w-6/12','w-7/12','w-8/12','w-9/12','w-10/12','w-11/12','w-full'
    ]
    return widths[Math.min(Math.max(currentStep,1), TOTAL_STEPS) - 1]
  }, [currentStep])

  // Progress fraction 0..1
  const progressFraction = (currentStep - 1) / Math.max(1, (TOTAL_STEPS - 1))
  React.useEffect(() => {
    if (onProgressChange) onProgressChange(Math.max(0, Math.min(1, progressFraction)))
  }, [progressFraction, onProgressChange])

  // Focus management and scroll on step change + smooth page animation control
  const stepRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (stepRef.current) {
      stepRef.current.focus()
      stepRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [currentStep])

  const updateFormData = (field: keyof GiftFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  // Hints removed per request; keeping stub for potential future use
  const getStepHint = (_stepKey: string): string | null => null

  const handleInterestToggle = (interest: string) => {
    const current = formData.interests || []
    if (current.includes(interest)) {
      updateFormData('interests', current.filter(i => i !== interest))
    } else if (current.length < 3) {
      updateFormData('interests', [...current, interest])
    }
  }

  const handleAvoidToggle = (category: string) => {
    const current = formData.avoid || []
    if (current.includes(category)) {
      updateFormData('avoid', current.filter(c => c !== category))
    } else {
      updateFormData('avoid', [...current, category])
    }
  }

  const goNext = () => {
    if (currentStep < TOTAL_STEPS) setCurrentStep(currentStep + 1)
    else onSubmit(formData as GiftFormData)
  }

  const goBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1)
  }

  const handleSingleChoice = (field: keyof GiftFormData, value: string) => {
    updateFormData(field, value)
    // Auto-advance after short delay; also reset downstream fields if options changed
    setTimeout(() => {
      // If the selection affects later step options, clear conflicting answers
      if (field === 'relationship') {
        setFormData(prev => ({
          ...prev,
          ageRange: undefined,
          occasion: prev.occasion, // keep for now; occasion filtering happens by gender/relationship below
        }))
      }
      if (field === 'gender') {
        if (onGenderChange) {
          try { onGenderChange(value) } catch {}
        }
        setFormData(prev => ({ ...prev, occasion: undefined }))
      }
      if (field === 'giftType') {
        // Interests/avoid lists may be reprioritized; keep selections but they remain valid
      }
      goNext()
    }, 250)
  }

  // No textarea step currently

  const canProceed = () => {
    const step = dynamicStepDefs[currentStep - 1]
    if (!step) return false
    if (step.type === 'multi') {
      if (step.key === 'interests') return (formData.interests?.length || 0) > 0
      if (step.key === 'avoid') return true
    }
    if (step.type === 'text') return true
    // No textarea steps at present
    // For radio steps, if already selected (going back), allow Next via explicit button
    return !!(formData as any)[step.key]
  }

  return (
    <Card className="w-full max-w-2xl glass-panel glow-ring shadow-xl shadow-fuchsia-200/30 relative overflow-hidden">
      <CardHeader>
        <CardTitle>Find the Perfect Gift</CardTitle>
        <CardDescription>
          Step {currentStep} of {TOTAL_STEPS} - Tell us about the gift recipient
        </CardDescription>
        <div className="mt-2 h-2 w-full bg-muted rounded">
          <div className={`h-2 bg-primary rounded transition-all duration-300 ${progressWidthClass}`} aria-hidden />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Dynamic single-question steps */}
        {(() => {
          const step = dynamicStepDefs[currentStep - 1]
          if (!step) return null
          if (step.type === 'radio') {
            return (
              <div className="space-y-2 step-anim outline-none" ref={stepRef} tabIndex={-1} aria-live="polite">
                <Label>{step.label}</Label>
                <RadioGroup value={(formData as any)[step.key] || ''} onValueChange={(value) => handleSingleChoice(step.key as keyof GiftFormData, value)} className="grid grid-cols-2 gap-3">
                  {step.options!.map(opt => (
                    <label key={opt} className="inline-flex items-center gap-2 rounded-lg border p-3 hover:bg-accent cursor-pointer">
                      <RadioGroupItem value={opt} />
                      <span className="text-sm">{opt}</span>
                    </label>
                  ))}
                </RadioGroup>
                {getStepHint(step.key) && (
                  <p className="text-xs text-muted-foreground mt-1">{getStepHint(step.key) as string}</p>
                )}
                {(formData as any)[step.key] && (
                  <div className="flex justify-end">
                    <Button onClick={goNext} variant="secondary">Next</Button>
                  </div>
                )}
              </div>
            )
          }
          if (step.key === 'interests' && step.type === 'multi') {
            return (
              <div className="space-y-2 step-anim outline-none" ref={stepRef} tabIndex={-1} aria-live="polite">
                <Label>{step.label}</Label>
                <div className="grid grid-cols-2 gap-3">
                  {step.options!.map((interest) => (
                    <div key={interest} className="flex items-center space-x-2">
                      <Checkbox
                        id={interest}
                        checked={formData.interests?.includes(interest) || false}
                        onCheckedChange={() => handleInterestToggle(interest)}
                        disabled={!formData.interests?.includes(interest) && (formData.interests?.length || 0) >= 3}
                      />
                      <Label htmlFor={interest} className="cursor-pointer">
                        {interest}
                      </Label>
                    </div>
                  ))}
                </div>
                <div className="text-xs text-muted-foreground mt-1">{(formData.interests?.length || 0)}/3 selected</div>
                {getStepHint(step.key) && (
                  <p className="text-xs text-muted-foreground">{getStepHint(step.key) as string}</p>
                )}
              </div>
            )
          }
          if (step.key === 'avoid' && step.type === 'multi') {
            return (
              <div className="space-y-2 step-anim outline-none" ref={stepRef} tabIndex={-1} aria-live="polite">
                <Label>{step.label}</Label>
                <div className="grid grid-cols-2 gap-3">
                  {step.options!.map((category) => (
                    <div key={category} className="flex items-center space-x-2">
                      <Checkbox
                        id={category}
                        checked={formData.avoid?.includes(category) || false}
                        onCheckedChange={() => handleAvoidToggle(category)}
                      />
                      <Label htmlFor={category} className="cursor-pointer">
                        {category}
                      </Label>
                    </div>
                  ))}
                </div>
                {getStepHint(step.key) && (
                  <p className="text-xs text-muted-foreground mt-1">{getStepHint(step.key) as string}</p>
                )}
              </div>
            )
          }
          if (step.type === 'text') {
            return (
              <div className="space-y-2 step-anim outline-none" ref={stepRef} tabIndex={-1} aria-live="polite">
                <Label htmlFor="location">{step.label}</Label>
                <div className="relative">
                  <Input
                    id="location"
                    placeholder="City or area (optional) — helps us suggest nearby ideas and events"
                    value={(formData as any).location || ''}
                    onChange={(e) => {
                      const v = e.target.value
                      updateFormData('location' as any, v)
                      setLocationQuery(v)
                    }}
                    onFocus={() => setLocationQuery(((formData as any).location || ''))}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); goNext() } }}
                    autoComplete="off"
                  />
                  {locationSuggestions.length > 0 && (
                    <div className="absolute z-20 mt-1 w-full rounded-md border bg-background shadow-lg">
                      <ul className="max-h-56 overflow-auto py-1 text-sm">
                        {locationSuggestions.map((s) => (
                          <li key={s}>
                            <button
                              type="button"
                              className="w-full text-left px-3 py-2 hover:bg-accent"
                              onClick={() => {
                                updateFormData('location' as any, s)
                                setLocationQuery(s)
                                setLocationSuggestions([])
                              }}
                            >
                              {s}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                <div className="flex justify-end">
                  {(((formData as any).location || '').trim().length > 0) ? (
                    <Button variant="secondary" size="sm" onClick={goNext}>Next</Button>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={goNext}>Skip</Button>
                  )}
                </div>
              </div>
            )
          }
          // No textarea step currently
          return null
        })()}
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button
          variant="outline"
          onClick={goBack}
          disabled={currentStep === 1}
        >
          Back
        </Button>
        <div className="flex items-center gap-2">
          {(() => {
            const step = dynamicStepDefs[currentStep - 1]
            if (step?.type === 'multi') {
              return (
                <Button onClick={goNext} disabled={!canProceed() || isLoading}>
                  Next
                </Button>
              )
            }
            if (currentStep === TOTAL_STEPS) {
              return (
                <Button onClick={() => onSubmit(formData as GiftFormData)} disabled={isLoading}>
                  {isLoading ? 'Finding Gifts...' : 'Find Gifts'}
                </Button>
              )
            }
            return null
          })()}
        </div>
      </CardFooter>
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/70 backdrop-blur-sm">
          <div className="relative flex flex-col items-center gap-3">
            <div className="relative w-14 h-14 rounded-xl bg-gradient-to-br from-pink-500 to-violet-500 animate-gift-bounce flex items-center justify-center shadow-lg">
              {/* Gift ribbon cross */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-2 h-10 bg-white/90 rounded-sm" />
                <div className="w-10 h-2 bg-white/90 rounded-sm absolute" />
              </div>
            </div>
            <div className="text-sm text-muted-foreground">Picking perfect presents…</div>
            {/* sparkles */}
            <span className="pg-sparkle pg-sparkle--a">*</span>
            <span className="pg-sparkle pg-sparkle--b">*</span>
          </div>
        </div>
      )}
      {/* Sticky mobile controls for multi-select & text steps */}
      {(() => {
        const step = dynamicStepDefs[currentStep - 1]
        const showSticky = step && (step.type === 'multi' || step.type === 'text' || step.type === 'textarea')
        if (!showSticky) return null
        return (
          <div className="fixed inset-x-0 bottom-0 z-30 md:hidden p-3">
            <div className="mx-auto max-w-md glass-panel glow-ring rounded-xl p-3 flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={goBack} disabled={currentStep === 1}>Back</Button>
              <Button size="sm" onClick={currentStep === TOTAL_STEPS ? () => onSubmit(formData as GiftFormData) : goNext} disabled={!canProceed() || isLoading}>
                {currentStep === TOTAL_STEPS ? (isLoading ? 'Finding…' : 'Find Gifts') : 'Next'}
              </Button>
            </div>
          </div>
        )
      })()}
    </Card>
  )
} 