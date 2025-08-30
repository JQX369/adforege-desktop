import { ReactNode } from 'react'

export default async function VendorLayout({ children }: { children: ReactNode }) {
	// Removed auth check to allow vendor page to be public
	// Auth will be handled on individual protected pages like dashboard
	return <>{children}</>
}
