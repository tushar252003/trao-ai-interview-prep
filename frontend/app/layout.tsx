import "./globals.css";
export const metadata={title:"Trao AI Interview Prep Kit",description:"Research-backed interview preparation"};
export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="en"><body>{children}</body></html>;
}
