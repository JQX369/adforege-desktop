import type { Meta, StoryObj } from '@storybook/react'
import { Input } from '@/src/ui/input'

const meta: Meta<typeof Input> = {
  title: 'UI/Input',
  component: Input,
  args: { placeholder: 'Type here...' },
}

export default meta
type Story = StoryObj<typeof Input>

export const Default: Story = {}
export const Disabled: Story = { args: { disabled: true } }
export const WithValue: Story = { args: { defaultValue: 'Hello' } }


