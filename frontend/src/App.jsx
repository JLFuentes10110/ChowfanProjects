import { useEffect, useState } from 'react';
import axios from 'axios';
import logo from './assets/logo.png';
import './App.css';
import Wallet from "./Wallet";
import Notes from "./Notes";

import CoffeeIcon from '@mui/icons-material/Coffee';
import WalletIcon from '@mui/icons-material/Wallet';

const ADA_DECIMALS = 1_000_000;
let cardanoSerializationLib;

/* Load CSL once */
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

/* Helpers */
const hexToBytes = (hex = '') =>
  new Uint8Array((hex.match(/.{1,2}/g) || []).map((byte) => parseInt(byte, 16)));

const bytesToHex = (bytes = new Uint8Array()) =>
  Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');

/* PREVIEW ONLY SAVED ADDRESS */
const SAVED_ADDRESSES = {
  preview: {
    label: "My Preview Address",
    address:
      "addr_test1qq38gpyc4s8rwt7ddcqqguccmajlt64qgh0a0008yrrxk0smqaphl82trrggq6gck2xkynn4wsnlxyg77f2hla565sysuusytn",
  },
};

/* PREVIEW-ONLY NETWORK DETECTION */
const detectNetworkFromAddress = (address) => {
  if (!address || address === "-") return "preview";
  if (address.startsWith("addr_test")) return "preview"; // Always preview
  if (address.startsWith("addr1")) return "mainnet";
  return "preview";
};

function App() {
  const [activeView, setActiveView] = useState("notes");

  const [notes, setNotes] = useState([]);
  const [form, setForm] = useState({ user_name: '', title: '', content: '' });

  const [walletStatus, setWalletStatus] = useState("disconnected");
  const [walletInfo, setWalletInfo] = useState({
    address: "-",
    rawAddress: "",
    balanceAda: "0.00",
    provider: "none",
  });

  const [walletError, setWalletError] = useState("");
  const [walletRefreshing, setWalletRefreshing] = useState(false);
  const [laceApi, setLaceApi] = useState(null);
  const [txForm, setTxForm] = useState({ recipient: '', amount: '' });
  const [txHistory, setTxHistory] = useState([]);
  const [txSending, setTxSending] = useState(false);

  const [network] = useState("preview");   // 🔥 LOCKED TO PREVIEW ONLY
  const [detectedNetwork, setDetectedNetwork] = useState("preview");

  const [addressCopied, setAddressCopied] = useState(false);
  const laceAvailable = typeof window !== "undefined" && Boolean(window.cardano?.lace);

  /* Load Notes */
  useEffect(() => {
    fetchNotes();
  }, []);

  /* Detect network AFTER wallet connects */
  useEffect(() => {
    if (walletStatus === "connected" && laceApi) detectWalletNetwork();
  }, [walletStatus, laceApi]);

  /* PREVIEW ONLY network detection */
  const detectWalletNetwork = async () => {
    if (!laceApi) return;

    try {
      const networkId = await laceApi.getNetworkId();

      if (networkId === 0) {
        // Testnet — Always treat as preview
        setDetectedNetwork("preview");
        return;
      }

      if (networkId === 1) {
        // Mainnet (not supported)
        setDetectedNetwork("mainnet");
        setWalletError("⚠️ Wallet is on MAINNET. This app only supports PREVIEW.");
        return;
      }
    } catch (err) {
      console.error("Error detecting wallet network:", err);
      setDetectedNetwork(detectNetworkFromAddress(walletInfo.address));
    }
  };

  /* Fetch Notes */
  const fetchNotes = async () => {
    try {
      const res = await axios.get("http://localhost:5000/notes");
      setNotes(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  /* Fetch Wallet Balance */
  const fetchWalletBalance = async () => {
    if (!laceApi || walletStatus !== "connected") return;

    setWalletRefreshing(true);
    try {
      setWalletInfo((prev) => ({ ...prev, balanceAda: "..." }));

      const balanceHex = await laceApi.getBalance();
      const csl = await getCsl();

      const value = csl.Value.from_bytes(hexToBytes(balanceHex));
      const lovelace = BigInt(value.coin().to_str());
      const balanceAda = (Number(lovelace) / ADA_DECIMALS).toFixed(2);

      setWalletInfo((prev) => ({ ...prev, balanceAda }));
      setWalletError("");
    } catch (err) {
      console.error("Error fetching balance:", err);
      setWalletInfo((prev) => ({ ...prev, balanceAda: "0.00" }));
      setWalletError("Unable to fetch balance.");
    } finally {
      setWalletRefreshing(false);
    }
  };

  /* Copy Address */
  const copyAddress = async () => {
    if (walletInfo.address && walletInfo.address !== "-") {
      try {
        await navigator.clipboard.writeText(walletInfo.address);
        setAddressCopied(true);
        setTimeout(() => setAddressCopied(false), 2000);
      } catch (err) {
        console.error("Failed to copy:", err);
      }
    }
  };

  /* Format Address */
  const formatAddress = (addr = "") =>
    addr.length <= 16 ? addr : `${addr.slice(0, 12)}...${addr.slice(-6)}`;

  /* Form Updates */
  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const handleTxFormChange = (e) =>
    setTxForm({ ...txForm, [e.target.name]: e.target.value });

  /* Add Note */
  const addNote = async () => {
    if (!form.user_name.trim() || !form.title.trim() || !form.content.trim()) return;
    try {
      const res = await axios.post("http://localhost:5000/notes", form);
      setNotes((prev) => [res.data, ...prev]);
      setForm({ user_name: "", title: "", content: "" });
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

  /* Connect Wallet */
  const connectWallet = async () => {
    setWalletError("");

    if (!laceAvailable) {
      setWalletInfo({
        address: "addr_test1qpcoffee0mock0wallet0lace0demo",
        rawAddress: "",
        balanceAda: "125.35",
        provider: "mock",
      });
      setWalletStatus("mock");
      setWalletError("Lace extension not detected. Running in mock mode.");
      return;
    }

    try {
      setWalletStatus("connecting");
      const api = await window.cardano.lace.enable();
      setLaceApi(api);

      const addresses = await api.getUsedAddresses();
      const addrHex = addresses?.[0] || (await api.getChangeAddress());
      const csl = await getCsl();

      const bech32 = csl.Address.from_bytes(hexToBytes(addrHex)).to_bech32();

      setWalletInfo({
        address: bech32,
        rawAddress: addrHex,
        balanceAda: "...",
        provider: "lace",
      });

      setWalletStatus("connected");
      await fetchWalletBalance();
    } catch (err) {
      console.error(err);
      setWalletStatus("error");
      setWalletError(err?.message || "Unable to connect to Lace.");
    }
  };

  /* Disconnect Wallet */
  const disconnectWallet = () => {
    setWalletInfo({
      address: "-",
      rawAddress: "",
      balanceAda: "0.00",
      provider: "none",
    });
    setWalletStatus("disconnected");
    setLaceApi(null);
    setTxHistory([]);
    setWalletError("");
  };

  /* Mock Transaction (only if Lace unavailable) */
  const runMockTransaction = async () => {
    const tx = {
      id: crypto.randomUUID(),
      recipient: txForm.recipient,
      amount: txForm.amount,
      timestamp: new Date().toISOString(),
      status: "simulated",
      mode: "mock",
      hash: `SIM-${Date.now()}`,
    };

    await new Promise((r) => setTimeout(r, 600));

    setTxHistory((prev) => [tx, ...prev]);
    setTxForm({ recipient: "", amount: "" });
  };

  /* Send Funds */
  const sendFunds = async () => {
    if (!txForm.recipient.trim() || Number(txForm.amount) <= 0) return;

    // MOCK MODE
    if (!laceAvailable || walletStatus !== "connected" || !laceApi) {
      setWalletError("Running in mock mode because Lace is not connected.");
      setTxSending(true);
      await runMockTransaction();
      setTxSending(false);
      return;
    }

    if (detectedNetwork !== "preview") {
      setWalletError("Wallet is NOT on Preview. Please switch the wallet network.");
      return;
    }

    // Normal transaction (unchanged except forced to preview)
    setTxSending(true);
    setWalletError("");

    try {
      await fetchWalletBalance();
      await new Promise((res) => setTimeout(res, 500));

      const csl = await getCsl();
      const amountLovelace = Math.floor(Number(txForm.amount) * ADA_DECIMALS);

      if (!Number.isFinite(amountLovelace) || amountLovelace <= 0) {
        throw new Error("Enter an amount greater than 0.");
      }

      const { data: protocol } = await axios.get(
        `http://localhost:5000/wallet/protocol-parameters?network=preview`
      );

      const { parameters, tip } = protocol;
      if (!parameters) throw new Error("Protocol parameters unavailable.");

      // Fetch UTXOs
      const utxosRaw = await laceApi.getUtxos();
      const utxos = Array.isArray(utxosRaw) ? utxosRaw : utxosRaw?.utxos || [];
      if (!utxos.length) throw new Error("No UTXOs available.");

      let totalInput = BigInt(0);
      const inputs = csl.TransactionInputs.new();

      for (const utxoHex of utxos) {
        const utxo = csl.TransactionUnspentOutput.from_bytes(hexToBytes(utxoHex));
        const output = utxo.output();
        const lovelaceValue = BigInt(output.amount().coin().to_str());
        totalInput += lovelaceValue;
        inputs.add(utxo.input());
      }

      const sendAmt = BigInt(amountLovelace);
      const linearFee = csl.LinearFee.new(
        csl.BigNum.from_str(String(parameters.min_fee_a)),
        csl.BigNum.from_str(String(parameters.min_fee_b))
      );

      const changeAddrHex = await laceApi.getChangeAddress();
      const changeBech32 = csl.Address.from_bytes(hexToBytes(changeAddrHex));

      const outputs = csl.TransactionOutputs.new();

      // Output to recipient
      const recipientAddr = csl.Address.from_bech32(txForm.recipient.trim());
      outputs.add(
        csl.TransactionOutput.new(
          recipientAddr,
          csl.Value.new(csl.BigNum.from_str(sendAmt.toString()))
        )
      );

      // Temporary fee estimate
      const feeEstimate = BigInt(200_000);

      let change = totalInput - sendAmt - feeEstimate;
      if (change < 0n) throw new Error("Insufficient balance.");

      outputs.add(
        csl.TransactionOutput.new(
          changeBech32,
          csl.Value.new(csl.BigNum.from_str(change.toString()))
        )
      );

      const ttl = (tip?.slot || 0) + 3600;
      const txBody = csl.TransactionBody.new(
        inputs,
        outputs,
        csl.BigNum.from_str(feeEstimate.toString()),
        csl.BigNum.from_str(ttl.toString())
      );

      const tx = csl.Transaction.new(txBody, csl.TransactionWitnessSet.new());
      const txHex = bytesToHex(tx.to_bytes());

      const witnessHex = await laceApi.signTx(txHex, true);
      const witnessSet = csl.TransactionWitnessSet.from_bytes(hexToBytes(witnessHex));

      const signed = csl.Transaction.new(txBody, witnessSet);
      const signedHex = bytesToHex(signed.to_bytes());

      let submitHash;
      try {
        const res = await axios.post("http://localhost:5000/wallet/submit", {
          tx: signedHex,
          network: "preview",
        });
        submitHash = res.data.hash || res.data;
      } catch (err) {
        console.error(err?.response?.data);
        throw new Error("Transaction submission failed");
      }

      // Record
      setTxHistory((prev) => [
        {
          id: submitHash,
          recipient: txForm.recipient,
          amount: txForm.amount,
          timestamp: new Date().toISOString(),
          status: "submitted",
          hash: submitHash,
          mode: "lace",
        },
        ...prev,
      ]);
      setTxForm({ recipient: "", amount: "" });
    } catch (err) {
      setWalletError(err?.message || "Transaction failed.");
    } finally {
      setTxSending(false);
    }
  };

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
              className={`sidebar-item ${activeView === "notes" ? "active" : ""}`}
              onClick={() => setActiveView("notes")}
            >
              <div className="sidebar-buttons">
                <CoffeeIcon /> Notes
              </div>
            </button>

            <button
              className={`sidebar-item ${activeView === "wallet" ? "active" : ""}`}
              onClick={() => setActiveView("wallet")}
            >
              <div className="sidebar-buttons">
                <WalletIcon /> Wallet
              </div>
            </button>
          </nav>
        </aside>

        <div className="content">
          {activeView === "notes" && (
            <Notes
              form={form}
              notes={notes}
              handleChange={handleChange}
              addNote={addNote}
              deleteNote={deleteNote}
            />
          )}

          {activeView === "wallet" && (
            <Wallet
              network="preview"        // 🔥 Always preview
              detectedNetwork={detectedNetwork}
              walletStatus={walletStatus}
              walletInfo={walletInfo}
              walletError={walletError}
              walletRefreshing={walletRefreshing}
              txSending={txSending}
              txForm={txForm}
              txHistory={txHistory}
              addressCopied={addressCopied}
              SAVED_ADDRESSES={SAVED_ADDRESSES}
              formatAddress={formatAddress}
              copyAddress={copyAddress}
              sendFunds={sendFunds}
              handleTxFormChange={handleTxFormChange}
              fetchWalletBalance={fetchWalletBalance}
              selectSavedAddress={(addr) =>
                setTxForm((prev) => ({ ...prev, recipient: addr }))
              }
              connectWallet={connectWallet}
              disconnectWallet={disconnectWallet}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
