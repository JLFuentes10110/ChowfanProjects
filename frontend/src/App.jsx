import { useEffect, useState } from 'react';
import axios from 'axios';
import logo from './assets/logo.png';
import './App.css';

import DeleteIcon from '@mui/icons-material/Delete';
import CoffeeIcon from '@mui/icons-material/Coffee';
import WalletIcon from '@mui/icons-material/Wallet';
import CoffeeMakerIcon from '@mui/icons-material/CoffeeMaker';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import PushPinIcon from '@mui/icons-material/PushPin';
import ElectricalServicesIcon from '@mui/icons-material/ElectricalServices';
import FaceIcon from '@mui/icons-material/Face';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

const ADA_DECIMALS = 1_000_000;
let cardanoSerializationLib;

const getCsl = async () => {
  if (!cardanoSerializationLib) {
    try {
      cardanoSerializationLib = await import('@emurgo/cardano-serialization-lib-browser');
    } catch (err) {
      console.error('Failed to load Cardano serialization library:', err);
      throw new Error('Cardano library failed to load. Please refresh the page.');
    }
  }
  return cardanoSerializationLib;
};

const hexToBytes = (hex = '') => {
  if (!hex) return new Uint8Array();
  return new Uint8Array((hex.match(/.{1,2}/g) || []).map((byte) => parseInt(byte, 16)));
};

const bytesToHex = (bytes = new Uint8Array()) =>
  Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

const SAVED_ADDRESSES = {
  preprod: {
    label: 'My Preprod Address',
    address: 'addr_test1qq38gpyc4s8rwt7ddcqqguccmajlt64qgh0a0008yrrxk0smqaphl82trrggq6gck2xkynn4wsnlxyg77f2hla565sysuusytn',
  },
  preview: {
    label: 'My Preview Address',
    address: 'addr_test1qq38gpyc4s8rwt7ddcqqguccmajlt64qgh0a0008yrrxk0smqaphl82trrggq6gck2xkynn4wsnlxyg77f2hla565sysuusytn',
  },
};

function App() {
  const [activeView, setActiveView] = useState('notes');
  const [notes, setNotes] = useState([]);
  const [form, setForm] = useState({ user_name: '', title: '', content: '' });
  const [walletStatus, setWalletStatus] = useState('disconnected');
  const [walletInfo, setWalletInfo] = useState({ address: '-', rawAddress: '', balanceAda: '0.00', provider: 'none' });
  const [walletError, setWalletError] = useState('');
  const [walletRefreshing, setWalletRefreshing] = useState(false);
  const [laceApi, setLaceApi] = useState(null);
  const [txForm, setTxForm] = useState({ recipient: '', amount: '' });
  const [txHistory, setTxHistory] = useState([]);
  const [txSending, setTxSending] = useState(false);
  const [network, setNetwork] = useState('preprod');
  const [addressCopied, setAddressCopied] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState(null);
  const laceAvailable = typeof window !== 'undefined' && Boolean(window.cardano?.lace);

  useEffect(() => { fetchNotes(); }, []);

  const fetchNotes = async () => {
    try {
      const res = await axios.get('http://localhost:5000/notes');
      setNotes(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  // NEW: Get balance directly from Lace wallet
  const fetchWalletBalance = async () => {
    if (!laceApi || walletStatus !== 'connected') return;
    
    setWalletRefreshing(true);
    try {
      setWalletInfo((prev) => ({ ...prev, balanceAda: '...' }));
      
      // Get balance directly from Lace
      const balanceHex = await laceApi.getBalance();
      const balanceLovelace = parseInt(balanceHex, 16);
      const balanceAda = (balanceLovelace / ADA_DECIMALS).toFixed(2);
      
      setWalletInfo((prev) => ({ ...prev, balanceAda }));
      setWalletError(''); // Clear any previous errors
    } catch (err) {
      console.error('Error fetching balance from Lace:', err);
      setWalletError('Unable to fetch balance from wallet.');
      setWalletInfo((prev) => ({ ...prev, balanceAda: '0.00' }));
    } finally {
      setWalletRefreshing(false);
    }
  };

  const copyAddress = async () => {
    if (walletInfo.address && walletInfo.address !== '-') {
      try {
        await navigator.clipboard.writeText(walletInfo.address);
        setAddressCopied(true);
        setTimeout(() => setAddressCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy address:', err);
      }
    }
  };

  const selectSavedAddress = (address) => {
    setTxForm((prev) => ({ ...prev, recipient: address }));
  };

  const convertHexToBech32 = async (hexAddress) => {
    if (!hexAddress) return '-';
    const csl = await getCsl();
    const address = csl.Address.from_bytes(hexToBytes(hexAddress));
    return address.to_bech32();
  };

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const handleTxFormChange = (e) => setTxForm({ ...txForm, [e.target.name]: e.target.value });

  const addNote = async () => {
    if (!form.user_name.trim() || !form.title.trim() || !form.content.trim()) return;
    try {
      const res = await axios.post('http://localhost:5000/notes', form);
      setNotes((prev) => [res.data, ...prev]);
      setForm({ user_name: '', title: '', content: '' });
    } catch (err) {
      console.error(err);
    }
  };

  const deleteNote = async (id) => {
    try {
      await axios.delete(`http://localhost:5000/notes/${id}`);
      setNotes((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const formatAddress = (addr = '') => (addr.length <= 16 ? addr : `${addr.slice(0, 12)}...${addr.slice(-6)}`);

  const connectWallet = async () => {
    setWalletError('');
    const mockPayload = {
      address: 'addr_test1qpcoffee0mock0wallet0lace0demo',
      rawAddress: '',
      balanceAda: '125.35',
      provider: 'mock',
    };

    if (!laceAvailable) {
      setWalletInfo(mockPayload);
      setWalletStatus('mock');
      setWalletError('Lace extension not detected. Running in mock mode.');
      return;
    }

    try {
      setWalletStatus('connecting');
      const api = await window.cardano.lace.enable();
      setLaceApi(api);
      const addresses = await api.getUsedAddresses();
      const detectedAddressHex = addresses?.[0] || (await api.getChangeAddress());
      const detectedAddress = await convertHexToBech32(detectedAddressHex);
      setWalletInfo({
        address: detectedAddress,
        rawAddress: detectedAddressHex,
        balanceAda: '...',
        provider: 'lace',
      });
      setWalletStatus('connected');
      
      // Fetch balance directly from Lace after connection
      const balanceHex = await api.getBalance();
      const balanceLovelace = parseInt(balanceHex, 16);
      const balanceAda = (balanceLovelace / ADA_DECIMALS).toFixed(2);
      setWalletInfo((prev) => ({ ...prev, balanceAda }));
    } catch (err) {
      console.error(err);
      setWalletStatus('error');
      setWalletError(err?.message || 'Unable to connect to Lace. Please approve the request.');
    }
  };

  const disconnectWallet = () => {
    setWalletInfo({ address: '-', rawAddress: '', balanceAda: '0.00', provider: 'none' });
    setWalletStatus('disconnected');
    setLaceApi(null);
    setTxHistory([]);
    setWalletError('');
  };

  const runMockTransaction = async () => {
    const txEntry = {
      id: crypto.randomUUID(),
      recipient: txForm.recipient,
      amount: txForm.amount,
      timestamp: new Date().toISOString(),
      status: 'simulated',
      mode: 'mock',
    };
    await new Promise((resolve) => setTimeout(resolve, 600));
    txEntry.hash = `SIM-${Date.now()}`;
    setTxHistory((prev) => [txEntry, ...prev]);
    setTxForm({ recipient: '', amount: '' });
  };

  const sendFunds = async () => {
    if (!txForm.recipient.trim() || Number(txForm.amount) <= 0) return;

    if (!laceAvailable || walletStatus !== 'connected' || !laceApi) {
      setWalletError('Running in mock mode because Lace is not connected.');
      setTxSending(true);
      try {
        await runMockTransaction();
      } finally {
        setTxSending(false);
      }
      return;
    }

    setTxSending(true);
    setWalletError('');
    try {
      const csl = await getCsl();
      const amountLovelace = Math.floor(Number(txForm.amount) * ADA_DECIMALS);
      if (!Number.isFinite(amountLovelace) || amountLovelace <= 0) {
        throw new Error('Enter an amount greater than 0');
      }

      const { data: protocol } = await axios.get(`http://localhost:5000/wallet/protocol-parameters?network=${network}`);
      const { parameters, tip } = protocol;
      if (!parameters) {
        throw new Error('Protocol parameters unavailable. Check backend configuration.');
      }
      const maxValueSize = Number(parameters.max_val_size || parameters.max_value_size || 5000);
      const maxTxSize = Number(parameters.max_tx_size || 16384);

      const txConfig = csl.TransactionBuilderConfigBuilder.new()
        .fee_algo(
          csl.LinearFee.new(
            csl.BigNum.from_str(String(parameters.min_fee_a)),
            csl.BigNum.from_str(String(parameters.min_fee_b))
          )
        )
        .coins_per_utxo_byte(csl.BigNum.from_str(String(parameters.coins_per_utxo_size)))
        .key_deposit(csl.BigNum.from_str(String(parameters.key_deposit)))
        .pool_deposit(csl.BigNum.from_str(String(parameters.pool_deposit)))
        .max_tx_size(maxTxSize)
        .max_value_size(maxValueSize)
        .build();

      const txBuilder = csl.TransactionBuilder.new(txConfig);
      const utxos = await laceApi.getUtxos(undefined, 50);

      if (!utxos || utxos.length === 0) {
        throw new Error('No UTXOs found in Lace wallet.');
      }

      utxos.forEach((utxoHex) => {
        const utxo = csl.TransactionUnspentOutput.from_bytes(hexToBytes(utxoHex));
        txBuilder.add_input(utxo.output().address(), utxo.input(), utxo.output().amount());
      });

      const recipientAddress = csl.Address.from_bech32(txForm.recipient.trim());
      const output = csl.TransactionOutput.new(
        recipientAddress,
        csl.Value.new(csl.BigNum.from_str(String(amountLovelace)))
      );
      txBuilder.add_output(output);

      const ttl = (tip?.slot || 0) + 3600;
      if (ttl > 0) {
        txBuilder.set_ttl(ttl);
      }

      const changeAddressHex = await laceApi.getChangeAddress();
      const changeAddress = csl.Address.from_bytes(hexToBytes(changeAddressHex));
      txBuilder.add_change_if_needed(changeAddress);

      const txBody = txBuilder.build();
      const tx = csl.Transaction.new(txBody, csl.TransactionWitnessSet.new());
      const txHex = bytesToHex(tx.to_bytes());

      const witnessSetHex = await laceApi.signTx(txHex, true);
      const txWitnessSet = csl.TransactionWitnessSet.from_bytes(hexToBytes(witnessSetHex));
      const signedTx = csl.Transaction.new(txBody, txWitnessSet, tx.auxiliary_data());
      const signedTxHex = bytesToHex(signedTx.to_bytes());

      const submitRes = await axios.post('http://localhost:5000/wallet/submit', { tx: signedTxHex, network });
      const txHash = submitRes.data.hash || `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;

      setTxHistory((prev) => [
        {
          id: txHash,
          recipient: txForm.recipient,
          amount: txForm.amount,
          timestamp: new Date().toISOString(),
          status: 'submitted',
          hash: txHash,
          mode: 'lace',
        },
        ...prev,
      ]);
      setTxForm({ recipient: '', amount: '' });
      
      // Refresh balance after sending
      await fetchWalletBalance();
    } catch (err) {
      console.error(err);
      const message =
        err?.response?.data?.error ||
        err?.message ||
        'Transaction failed or was rejected. Please check backend logs.';
      setWalletError(message);
    } finally {
      setTxSending(false);
    }
  };

  const renderNotes = () => (
    <div className="notes-view">
      <header className="header">
        <img src={logo} className="coffee-icon" />
        <h1 className="title">Coffee Notes</h1>
        <p className="subtitle">Brew your thoughts, one note at a time</p>
      </header>

      <div className="form-container">
        <div className="form-group">
          <label className="input-label" htmlFor="user_name">
            Your Name
          </label>
          <input id="user_name" name="user_name" value={form.user_name} onChange={handleChange} className="input-field" />
        </div>

        <div className="form-group">
          <label className="input-label" htmlFor="title">
            Note Title
          </label>

          <input id="title" name="title" value={form.title} onChange={handleChange} className="input-field" />
        </div>
        <div className="form-group">
          <textarea
            name="content"
            value={form.content}
            onChange={handleChange}
            placeholder="What's brewing in your mind?"
            rows={4}
            className="textarea-field"
          />
        </div>
        <button onClick={addNote} className="add-button">
          <CoffeeMakerIcon />
          Brew New Note
        </button>
      </div>

      <div className="notes-container">
        {notes.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📄</div>
            <p>No notes yet. Start brewing your first thought!</p>
          </div>
        ) : (
          <div className="notes-grid">
            {notes.map((note) => (
              <div key={note.id} className="note-card">
                <div className="note-header">
                  <h3 className="note-title">{note.title}</h3>
                  <button
                    onClick={() => {
                      setNoteToDelete(note.id);
                      setShowDeleteModal(true);
                    }}
                    className="delete-button"
                    title="Delete note"
                  >
                    <DeleteIcon />
                  </button>
                </div>
                <div className="note-content">{note.content}</div>
                <div className="note-footer">
                  <span className="note-author"><FaceIcon /> {note.user_name}</span>
                  <span className="note-date">
                    {new Date(note.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderWallet = () => (
    <div className="wallet-view">
      <header className="header wallet-header">
        <img src={logo} className="coffee-icon" />
        <h1 className="title">Coffee Wallet</h1>
        <p className="subtitle">Brewed for Lace • Cardano-ready</p>
      </header>

      <div className="wallet-grid">
        <div className="wallet-card">
          <div className="wallet-card-header">
            <h2>Wallet Status</h2>
            <div className="network-selector">
              <label className="wallet-label">Network</label>
              <select
                value={network}
                onChange={(e) => {
                  setNetwork(e.target.value);
                }}
                className="network-select"
              >
                <option value="preprod">Preprod</option>
                <option value="preview">Preview</option>
              </select>
            </div>
          </div>
          <p className={`status-badge status-${walletStatus}`}>{walletStatus === 'mock' ? 'Mock Mode' : walletStatus}</p>
          <p className="wallet-label">Provider</p>
          <p className="wallet-value">{walletInfo.provider}</p>
          <p className="wallet-label">Address</p>
          <div className="address-display">
            <p className="wallet-value">{formatAddress(walletInfo.address)}</p>
            {walletInfo.address !== '-' && (
              <button className="copy-address-btn" onClick={copyAddress} title="Copy full address">
                {addressCopied ? '✓ Copied' : <ContentCopyIcon fontSize="small" style={{ verticalAlign: 'middle'}} />}
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
                <span className="button-icon">🔒</span>
                Disconnect
              </button>
            )}
            {walletStatus === 'connected' && (
              <button
                className="add-button refresh-button"
                onClick={fetchWalletBalance}
                disabled={walletRefreshing}
              >
                <span className="button-icon">🔄</span>
                Refresh
              </button>
            )}
          </div>
          {walletError && <p className="wallet-error">{walletError}</p>}
        </div>

        <div className="wallet-card tx-card">
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
            <label className="input-label" htmlFor="recipient">
              Recipient Address
            </label>
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
            <label className="input-label" htmlFor="amount">
              Amount (₳)
            </label>
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
          <button className="add-button send-button" onClick={sendFunds} disabled={txSending}>
            <RocketLaunchIcon />
            {txSending ? 'Sending...' : 'Send Transaction'}
          </button>
          <p className="wallet-hint">
            Balance is fetched directly from your Lace wallet. Transactions still require backend for protocol parameters.
          </p>
        </div>
      </div>

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

  return (
    <div className="app">
      <div className="app-shell">
        <aside className="sidebar">
          <div className="sidebar-header">
            <img src={logo} className="sidebar-logo" />
            <div>
              <p className="sidebar-title">Chowfan</p>
              <p className="sidebar-subtitle">Coffee Suite</p>
            </div>
          </div>
          <nav className="sidebar-menu">
            <button
              className={`sidebar-item ${activeView === 'notes' ? 'active' : ''}`}
              onClick={() => setActiveView('notes')}
            >
              <div className="sidebar-buttons">
                <CoffeeIcon /> Notes
              </div>
            </button>
            <button
              className={`sidebar-item ${activeView === 'wallet' ? 'active' : ''}`}
              onClick={() => setActiveView('wallet')}
            >
              <div className="sidebar-buttons">
                <WalletIcon /> Wallet
              </div>
            </button>
          </nav>
          <div className="sidebar-footer">
            <p>Powered by Lace-ready UI</p>
          </div>
        </aside>
        <div className="content">{activeView === 'notes' ? renderNotes() : renderWallet()}</div>
      </div>
      {showDeleteModal && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3>Delete Note</h3>
            <p>Are you sure you want to delete this note?</p>

            <div className="modal-buttons">
              <button
                className="cancel-delete"
                onClick={() => setShowDeleteModal(false)}
              >
                Cancel
              </button>
              <button
                className="confirm-delete"
                onClick={() => {
                  deleteNote(noteToDelete);
                  setShowDeleteModal(false);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;