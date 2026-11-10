// Change this URL once; the footer link follows it.
export const DEVELOPER_URL = 'https://github.com/orgs/DevOrgN/repositories';

export default function Footer() {
  return (
    <footer className="site-footer">
      <span>Made by</span>
      <a className="developer-link" href={DEVELOPER_URL} target="_blank" rel="noopener noreferrer">DevOrgN</a>
    </footer>
  );
}
