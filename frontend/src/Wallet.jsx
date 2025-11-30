import React, { useEffect } from "react";
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
  detectedNetwork, // new prop to detect wallet network
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

  //Force network to preview PERMANENTLY
  useEffect(() => {
    setNetwork("preview");
  }, []);

  //Only show mismatch if wallet is NOT preview
  const networkMismatch =
    walletStatus === 'connected' &&
    detectedNetwork &&
    detectedNetwork.toLowerCase() !== "preview";

  return (
    <div className="wallet-view">
      <header className="header wallet-header">
        <img src={headercoffee} className="coffee-icon" />
        <h1 className="title">Coffee Wallet</h1>
        <p className="subtitle">Brewed for Lace • Cardano-ready</p>
      </header>

      <div className="wallet-grid">

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

              {/*Replaced dropdown with fixed preview label */}
              <div className="network-select static-network">
                <span>Preview Network</span>
              </div>
            </div>
          </div>

          {/*Show mismatch ONLY if wallet network ≠ preview */}
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
                Network mismatch! Your wallet is on <strong>{detectedNetwork}</strong> 
                but this app is locked to <strong>Preview</strong>.  
                Please switch to Preview in Lace settings.
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
            {walletInfo.address !== '-' && (
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
        <div className="wallet-card tx-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: '300px', flex: 2 }}>  {/* Added inline styles to match Wallet Status card */}
          <h2>Send ADA</h2>

          <div className="address-book">
            <p className="wallet-label">Quick Select</p>
            <div className="address-book-buttons">

              {SAVED_ADDRESSES[network]?.address && (
                <button
                  className="address-book-btn"
                  onClick={() => selectSavedAddress(SAVED_ADDRESSES[network].address)}
                  title={SAVED_ADDRESSES[network].label}
                >
                  <PushPinIcon /> {SAVED_ADDRESSES[network].label}
                </button>
              )}

              {SAVED_ADDRESSES.preprod?.address && network !== 'preprod' && (
                <button
                  className="address-book-btn"
                  onClick={() => selectSavedAddress(SAVED_ADDRESSES.preprod.address)}
                  title={SAVED_ADDRESSES.preprod.label}
                >
                  <PushPinIcon /> {SAVED_ADDRESSES.preprod.label}
                </button>
              )}

              {SAVED_ADDRESSES.preview?.address && network !== 'preview' && (
                <button
                  className="address-book-btn"
                  onClick={() => selectSavedAddress(SAVED_ADDRESSES.preview.address)}
                  title={SAVED_ADDRESSES.preview.label}
                >
                  <PushPinIcon /> {SAVED_ADDRESSES.preview.label}
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
