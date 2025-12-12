import React from "react";
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ElectricalServicesIcon from '@mui/icons-material/ElectricalServices';
import PushPinIcon from '@mui/icons-material/PushPin';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import WarningIcon from '@mui/icons-material/Warning';
import headercoffee from "./assets/logo.png";
import './App.css';

export default function Wallet({
  logo,
  network,
  setNetwork,
  walletStatus,
  walletInfo,
  walletRefreshing,
  walletError,
  addressCopied,
  txSending,
  txForm,
  txHistory,
  detectedNetwork, // network returned by Lace/wallet
  SAVED_ADDRESSES,
  formatAddress,
  copyAddress,
  connectWallet,
  disconnectWallet,
  fetchWalletBalance,
  handleTxFormChange,
  selectSavedAddress,
  sendFunds
}) {
  // Normalize helper for comparisons and for saved-address lookup keys
  const normalize = (net) =>
    typeof net === "string" ? net.trim().toLowerCase() : net;

  const normalizedNetwork = normalize(network); // e.g. "preview"
  const normalizedDetected = normalize(detectedNetwork);

  // Access saved addresses using normalized keys to avoid Preview/preview mismatch
  const getSaved = (key) => {
    const k = normalize(key);
    if (!k || !SAVED_ADDRESSES) return undefined;
    // If SAVED_ADDRESSES uses plain keys like 'preview', 'preprod', fallback defensively
    if (SAVED_ADDRESSES[k]) return SAVED_ADDRESSES[k];
    // if keys are stored differently (rare), attempt to find a case-insensitive match
    const foundKey = Object.keys(SAVED_ADDRESSES).find(
      (x) => normalize(x) === k
    );
    return foundKey ? SAVED_ADDRESSES[foundKey] : undefined;
  };

  // Determine true mismatch using normalized values
  const networkMismatch =
    walletStatus === "connected" &&
    normalizedDetected &&
    normalizedDetected !== normalizedNetwork;

  // Convenience booleans for specific networks
  const isPreviewSelected = normalizedNetwork === "preview";
  const isPreprodSelected = normalizedNetwork === "preprod";

  // Saved addresses for currently selected network
  const savedForSelected = getSaved(normalizedNetwork);
  const savedPreview = getSaved("preview");
  const savedPreprod = getSaved("preprod");

  return (
    <div className="wallet-view">
      <header className="header wallet-header">
        <img src={headercoffee} className="coffee-icon" />
        <h1 className="title">Coffee Wallet</h1>
        <p className="subtitle">Brewed for Lace • Cardano-ready</p>
      </header>

      <div className="wallet-grid" style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap', padding: '30px' }}>
        {/* WALLET STATUS CARD */}
        <div className="wallet-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: '300px', flex: 1 }}>
          <div className="wallet-card-header" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h2>Wallet Status</h2>

            <div className="network-selector">
              <label className="wallet-label">Network
                {detectedNetwork && walletStatus === 'connected' && (
                  <span style={{ fontSize: '0.75rem', opacity: 0.8, marginLeft: '4px' }}>
                    (Wallet: {detectedNetwork})
                  </span>
                )}
              </label>

              {/* Show the selected network (normalized to uppercase label) */}
              <div className="network-select static-network">
                <span>{(normalizedNetwork || 'preview').toUpperCase()} Network</span>
              </div>
            </div>
          </div>

          {/* Accurate mismatch banner (only shows when the normalized values differ) */}
          {networkMismatch && (
            <div style={{
              background: '#fff3cd',
              border: '1px solid #ffc107',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              fontSize: '0.85rem',
              color: '#856404'
            }}>
              <WarningIcon style={{ fontSize: '18px', marginTop: '1px' }} />
              <span>
                Network mismatch! Your wallet is on <strong>{detectedNetwork}</strong> but you selected <strong>{network}</strong>.
                Switch the wallet network to <strong>{normalizedNetwork}</strong> or change your selected network in Lace settings.
              </span>
            </div>
          )}

          <p className={`status-badge status-${walletStatus}`}>
            {walletStatus === 'mock' ? 'Mock Mode' : walletStatus}
          </p>

          <p className="wallet-label">Provider</p>
          <p className="wallet-value">{walletInfo.provider}</p>

          <p className="wallet-label">Address</p>
          <div className="address-display">
            <p className="wallet-value">{formatAddress(walletInfo.address)}</p>
            {walletInfo.address && walletInfo.address !== '-' && (
              <button
                className="copy-address-btn"
                onClick={copyAddress}
                title="Copy full address"
              >
                {addressCopied ? '✓ Copied' : (
                  <ContentCopyIcon fontSize="small" style={{ verticalAlign: 'middle' }} />
                )}
              </button>
            )}
          </div>

          <p className="wallet-label">Balance (₳)</p>
          <p className="wallet-balance">
            {walletInfo.balanceAda}
            {walletRefreshing && <span className="wallet-refresh">Refreshing...</span>}
          </p>

          <div className="wallet-actions">
            {walletStatus !== 'connected' ? (
              <button className="add-button connect-button" onClick={connectWallet}>
                <ElectricalServicesIcon />
                Connect Lace
              </button>
            ) : (
              <button className="add-button disconnect-button" onClick={disconnectWallet}>
                Disconnect
              </button>
            )}

            {walletStatus === 'connected' && (
              <button
                className="add-button refresh-button"
                onClick={fetchWalletBalance}
                disabled={walletRefreshing}
              >
                Refresh
              </button>
            )}
          </div>

          {walletError && <p className="wallet-error">{walletError}</p>}
        </div>

        {/* SEND ADA CARD */}
        <div className="wallet-card tx-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: '300px', flex: 2 }}>
          <h2>Send ADA</h2>

          <div className="address-book">
            <p className="wallet-label">Quick Select</p>
            <div className="address-book-buttons">

              {/* Use savedForSelected which resolves using normalized key */}
              {savedForSelected?.address && (
                <button
                  className="address-book-btn"
                  onClick={() => selectSavedAddress(savedForSelected.address)}
                  title={savedForSelected.label}
                >
                  <PushPinIcon /> {savedForSelected.label}
                </button>
              )}

              {/* If preview is available and not currently selected, show it as quick pick */}
              {savedPreview?.address && !isPreviewSelected && (
                <button
                  className="address-book-btn"
                  onClick={() => selectSavedAddress(savedPreview.address)}
                  title={savedPreview.label}
                >
                  <PushPinIcon /> {savedPreview.label}
                </button>
              )}

              {/* If preprod is available and not currently selected, show it as quick pick */}
              {savedPreprod?.address && !isPreprodSelected && (
                <button
                  className="address-book-btn"
                  onClick={() => selectSavedAddress(savedPreprod.address)}
                  title={savedPreprod.label}
                >
                  <PushPinIcon /> {savedPreprod.label}
                </button>
              )}

            </div>
          </div>

          <div className="form-group">
            <label className="input-label" htmlFor="recipient">Recipient Address</label>
            <input
              id="recipient"
              name="recipient"
              value={txForm.recipient}
              onChange={handleTxFormChange}
              className="input-field"
              placeholder="addr..."
            />
          </div>

          <div className="form-group">
            <label className="input-label" htmlFor="amount">Amount (₳)</label>
            <input
              id="amount"
              name="amount"
              type="number"
              min="0"
              value={txForm.amount}
              onChange={handleTxFormChange}
              className="input-field"
              placeholder="0.00"
            />
          </div>

          <button
            className="add-button send-button"
            onClick={sendFunds}
            disabled={txSending}
          >
            <RocketLaunchIcon />
            {txSending ? 'Sending...' : 'Send Transaction'}
          </button>

          <p className="wallet-hint">
            Balance is fetched directly from your Lace wallet.
            Transactions still require backend for protocol parameters.
          </p>
        </div>
      </div>

      {/* HISTORY */}
      <div className="wallet-card history-card">
        <h2>Recent Activity</h2>

        {txHistory.length === 0 ? (
          <p className="wallet-hint">No transactions yet. Send ADA to see activity.</p>
        ) : (
          <ul className="tx-history">
            {txHistory.map((tx) => (
              <li key={tx.id} className="tx-item">
                <div>
                  <p className="tx-address">{formatAddress(tx.recipient)}</p>
                  <p className="tx-meta">
                    {new Date(tx.timestamp).toLocaleString()} • {tx.status}
                    {tx.mode ? ` • ${tx.mode}` : ''}
                  </p>
                </div>
                <div className="tx-amount">
                  {tx.amount} ₳
                  {tx.hash && <span className="tx-hash">{tx.hash}</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}