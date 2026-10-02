import Link from "next/link";
export default function NotFound() {
  return <main className="page-state"><img className="pixel-art" src="/art/chest.png" alt="" width={80} height={80} /><h1>This chest is empty.</h1><p>That page is not part of the workshop.</p><Link className="pixel-button" href="/">Back to the workshop</Link></main>;
}
