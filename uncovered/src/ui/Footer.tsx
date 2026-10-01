import { Link } from '../lib/router';
import { Seal } from '../seal/Seal';
import { Microtext } from './Microtext';
import styles from './Footer.module.css';

export function Footer() {
  return (
    <footer className={styles.footer}>
      <Microtext text="Uncovered · Initiating coverage on every company · " />
      <div className={`page ${styles.grid}`}>
        <div className={styles.brand}>
          <Seal
            seed="Uncovered"
            size={132}
            ring="Uncovered Research · Initiating coverage on every company"
            draw="static"
            sheen
            monogram="U"
          />
          <p className={styles.motto}>
            Initiating coverage on <em>every</em> company.
          </p>
        </div>
        <nav aria-label="Footer" className={styles.cols}>
          <div>
            <h2 className={styles.head}>Read</h2>
            <ul role="list">
              <li>
                <Link to="/report/krka">Sample report: Krka</Link>
              </li>
              <li>
                <Link to="/method">Method</Link>
              </li>
              <li>
                <Link to="/#how">How it works</Link>
              </li>
            </ul>
          </div>
          <div>
            <h2 className={styles.head}>Start</h2>
            <ul role="list">
              <li>
                <Link to="/initiate">Initiate coverage</Link>
              </li>
              <li>
                <Link to="/#pricing">Pricing</Link>
              </li>
            </ul>
          </div>
        </nav>
        <p className={styles.fine}>
          Uncovered reports are research, not investment advice. They describe what the evidence shows and what a price
          implies under stated assumptions; they are not recommendations to buy or sell any security. Reported figures
          are footnoted to their sources; estimates are labelled.
        </p>
      </div>
      <div className={`page ${styles.base}`}>
        <span>© 2026 Uncovered Research</span>
        <span>Set in Bodoni Moda and Hanken Grotesk · Seals engraved from each company’s name</span>
      </div>
      <Microtext hidden text="UV inspection · Genuine Uncovered document · Every figure footnoted · " />
    </footer>
  );
}
