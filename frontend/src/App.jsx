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

const detectNetworkFromAddress = async (address) => {
  if (!address || address === '-') return 'preprod';
  
  if (address.startsWith('addr_test')) {
    return 'preprod';
  } else if (address.startsWith('addr')) {
    return 'mainnet';
  }
  return 'preprod';
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
  const [detectedNetwork, setDetectedNetwork] = useState(null);
  const [addressCopied, setAddressCopied] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState(null);
  const laceAvailable = typeof window !== 'undefined' && Boolean(window.cardano?.lace);

  useEffect(() => { 
    fetchNotes(); 
  }, []);

  useEffect(() => {
    if (walletStatus === 'connected' && laceApi) {
      detectWalletNetwork();
    }
  }, [walletStatus, laceApi]);

  const detectWalletNetwork = async () => {
    if (!laceApi) return;
    
    try {
      const networkId = await laceApi.getNetworkId();
      
      if (networkId === 0) {
        const address = walletInfo.address;
        
        try {
          await axios.get(`http://localhost:5000/wallet/balance/${address}?network=preview`);
          setDetectedNetwork('preview');
          setNetwork('preview');
          return;
        } catch (previewErr) {
          try {
            await axios.get(`http://localhost:5000/wallet/balance/${address}?network=preprod`);
            setDetectedNetwork('preprod');
            setNetwork('preprod');
            return;
          } catch (preprodErr) {
            console.error('Could not detect network from either preprod or preview');
            setDetectedNetwork('preview');
          }
        }
      } else if (networkId === 1) {
        setDetectedNetwork('mainnet');
        setWalletError('Mainnet detected. This app only supports preprod and preview testnets.');
      }
    } catch (err) {
      console.error('Error detecting wallet network:', err);
      const detected = await detectNetworkFromAddress(walletInfo.address);
      setDetectedNetwork(detected);
      setNetwork(detected);
    }
  };

  const fetchNotes = async () => {
    try {
      const res = await axios.get('http://localhost:5000/notes');
      setNotes(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchWalletBalance = async () => {
    if (!laceApi || walletStatus !== 'connected') return;

    setWalletRefreshing(true);
    try {
      setWalletInfo((prev) => ({ ...prev, balanceAda: '...' }));

      const balanceHex = await laceApi.getBalance();
      const csl = await getCsl();

      const value = csl.Value.from_bytes(hexToBytes(balanceHex));
      const lovelace = BigInt(value.coin().to_str());
      const balanceAda = (Number(lovelace) / ADA_DECIMALS).toFixed(2);

      setWalletInfo((prev) => ({ ...prev, balanceAda }));
      setWalletError('');
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

  const handleNetworkChange = (newNetwork) => {
    if (walletStatus === 'connected' && detectedNetwork && detectedNetwork !== newNetwork) {
      setWalletError(`⚠️ Wallet is on ${detectedNetwork} but you selected ${newNetwork}.`);
    } else {
      setWalletError('');
    }
    setNetwork(newNetwork);
  };

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

      const balanceHex = await api.getBalance();
      const csl = await getCsl();

      const value = csl.Value.from_bytes(hexToBytes(balanceHex));
      const lovelace = BigInt(value.coin().to_str());
      const balanceAda = (Number(lovelace) / ADA_DECIMALS).toFixed(2);

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

    if (detectedNetwork && detectedNetwork !== network) {
      setWalletError(`Cannot send: Wallet is on ${detectedNetwork} but you selected ${network}. Please change the network selector to match your wallet.`);
      return;
    }

    setTxSending(true);
    setWalletError('');
    
    try {
      console.log('Refreshing wallet state before transaction...');
      await fetchWalletBalance();
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const csl = await getCsl();
      const amountLovelace = Math.floor(Number(txForm.amount) * ADA_DECIMALS);
      
      console.log('=== TRANSACTION DETAILS ===');
      console.log('Amount from form:', txForm.amount, 'ADA');
      console.log('Amount in lovelace:', amountLovelace);
      console.log('===========================');
      
      if (!Number.isFinite(amountLovelace) || amountLovelace <= 0) {
        throw new Error('Enter an amount greater than 0');
      }

      const { data: protocol } = await axios.get(`http://localhost:5000/wallet/protocol-parameters?network=${network}`);
      const { parameters, tip } = protocol;
      if (!parameters) {
        throw new Error('Protocol parameters unavailable. Check backend configuration.');
      }

      console.log('Fetching fresh UTXOs from wallet...');
      const utxosResult = await laceApi.getUtxos();
      console.log("UTXOs structure:", utxosResult);

      let utxos;
      if (Array.isArray(utxosResult)) {
        utxos = utxosResult;
      } else if (utxosResult && typeof utxosResult === 'object') {
        utxos = utxosResult.utxos || [];
      } else {
        utxos = [];
      }

      console.log("Processed UTXOs:", utxos);

      if (!utxos || utxos.length === 0) {
        throw new Error('No UTXOs found. Your wallet may be empty or using only change addresses.');
      }

      // Calculate total input - KEEP BOTH VARIABLES
      let totalInputValue = csl.BigNum.from_str('0');
      let totalInputLovelace = csl.BigNum.from_str('0');
      utxos.forEach((utxoHex) => {
        const utxo = csl.TransactionUnspentOutput.from_bytes(hexToBytes(utxoHex));
        const output = utxo.output();
        const inputAmount = output.amount().coin();
        totalInputValue = totalInputValue.checked_add(inputAmount);
        totalInputLovelace = totalInputLovelace.checked_add(inputAmount);
        console.log(`UTXO: ${utxo.input().transaction_id().to_hex()}#${utxo.input().index()}, Amount: ${inputAmount.to_str()}`);
      });

      console.log(`Total input value: ${totalInputValue.to_str()} lovelace`);

      const requiredLovelace = csl.BigNum.from_str(String(amountLovelace));
      const estimatedFee = csl.BigNum.from_str('200000');
      const totalRequired = requiredLovelace.checked_add(estimatedFee);

      if (totalInputValue.compare(totalRequired) < 0) {
        throw new Error(`Insufficient funds. Need ${(Number(totalRequired.to_str()) / ADA_DECIMALS).toFixed(2)} ADA but only have ${(Number(totalInputValue.to_str()) / ADA_DECIMALS).toFixed(2)} ADA`);
      }

      // Build transaction manually
      console.log('Building transaction body manually...');
      
      const currentSlot = tip?.slot || tip?.slot_no || 0;
      const ttlSlots = 3600;
      const ttl = currentSlot + ttlSlots;
      
      console.log('Current slot:', currentSlot);
      console.log('TTL slot:', ttl);
      
      const inputs = csl.TransactionInputs.new();
      
      console.log('Adding inputs to transaction...');
      for (const utxoHex of utxos) {
        const utxo = csl.TransactionUnspentOutput.from_bytes(hexToBytes(utxoHex));
        inputs.add(utxo.input());
        console.log(`Adding input: ${utxo.input().transaction_id().to_hex()}#${utxo.input().index()}`);
        console.log(`  Address: ${utxo.output().address().to_bech32()}`);
        console.log(`  Amount: ${utxo.output().amount().coin().to_str()} lovelace`);
      }
      
      console.log(`Total input for TX: ${totalInputLovelace.to_str()} lovelace (${(Number(totalInputLovelace.to_str()) / ADA_DECIMALS).toFixed(2)} ADA)`);
      
      const outputs = csl.TransactionOutputs.new();
      
      const recipientAddress = csl.Address.from_bech32(txForm.recipient.trim());
      const sendAmount = csl.BigNum.from_str(String(amountLovelace));
      const recipientOutput = csl.TransactionOutput.new(
        recipientAddress,
        csl.Value.new(sendAmount)
      );
      outputs.add(recipientOutput);
      console.log(`Added recipient output: ${amountLovelace} lovelace (${(amountLovelace / ADA_DECIMALS).toFixed(2)} ADA)`);
      console.log(`Recipient address: ${txForm.recipient}`);
      
      const changeAddressHex = await laceApi.getChangeAddress();
      const changeAddress = csl.Address.from_bytes(hexToBytes(changeAddressHex));
      console.log('Adding change address:', changeAddress.to_bech32());
      
      const initialEstimatedFee = csl.BigNum.from_str('200000');
      const initialChangeAmount = totalInputLovelace
        .checked_sub(sendAmount)
        .checked_sub(initialEstimatedFee);
      
      const changeOutput = csl.TransactionOutput.new(
        changeAddress,
        csl.Value.new(initialChangeAmount)
      );
      outputs.add(changeOutput);
      
      const txBody = csl.TransactionBody.new(
        inputs,
        outputs,
        initialEstimatedFee,
        ttl > 0 ? csl.BigNum.from_str(String(ttl)) : undefined
      );

      const tempTx = csl.Transaction.new(txBody, csl.TransactionWitnessSet.new());
      
      const linearFee = csl.LinearFee.new(
        csl.BigNum.from_str(String(parameters.min_fee_a)),
        csl.BigNum.from_str(String(parameters.min_fee_b))
      );
      
      // Calculate fee with witness overhead (each signature is ~100 bytes, so add buffer)
      const baseFee = csl.min_fee(tempTx, linearFee);
      const witnessOverhead = csl.BigNum.from_str('10000'); // Add ~0.01 ADA for witness overhead
      const calculatedFee = baseFee.checked_add(witnessOverhead);
      
      console.log(`Calculated fee: ${calculatedFee.to_str()} lovelace (~${(Number(calculatedFee.to_str()) / ADA_DECIMALS).toFixed(6)} ADA)`);
      
      const finalChangeAmount = totalInputLovelace
        .checked_sub(sendAmount)
        .checked_sub(calculatedFee);
      
      console.log(`Final change: ${finalChangeAmount.to_str()} lovelace (${(Number(finalChangeAmount.to_str()) / ADA_DECIMALS).toFixed(2)} ADA)`);
      
      const finalOutputs = csl.TransactionOutputs.new();
      finalOutputs.add(recipientOutput);
      
      const finalChangeOutput = csl.TransactionOutput.new(
        changeAddress,
        csl.Value.new(finalChangeAmount)
      );
      finalOutputs.add(finalChangeOutput);
      
      const finalTxBody = csl.TransactionBody.new(
        inputs,
        finalOutputs,
        calculatedFee,
        ttl > 0 ? ttl : undefined
      );
      
      const tx = csl.Transaction.new(finalTxBody, csl.TransactionWitnessSet.new());
      const txHex = bytesToHex(tx.to_bytes());

      const witnessSetHex = await laceApi.signTx(txHex, true);
      const txWitnessSet = csl.TransactionWitnessSet.from_bytes(hexToBytes(witnessSetHex));
      const signedTx = csl.Transaction.new(finalTxBody, txWitnessSet, tx.auxiliary_data());
      const signedTxHex = bytesToHex(signedTx.to_bytes());

      let txHash;
      try {
        const submitRes = await axios.post('http://localhost:5000/wallet/submit', { tx: signedTxHex, network });
        txHash = submitRes.data.hash || submitRes.data;
        
        if (typeof txHash === 'string') {
          txHash = txHash.trim();
        }
        
        console.log('Transaction submitted successfully! Hash:', txHash);
      } catch (submitErr) {
        console.log('Submit error details:', submitErr?.response?.data);
        
        const errorData = submitErr?.response?.data || {};
        const errorText = errorData.message || errorData.error || JSON.stringify(errorData);
        
        console.log('Error text:', errorText);
        
        const hashMatch = errorText.match(/[a-f0-9]{64}/i);
        if (hashMatch) {
          txHash = hashMatch[0];
          console.log('Transaction may have been submitted. Extracted hash from error:', txHash);
        } else {
          if (errorText.includes('already') || errorText.includes('duplicate')) {
            console.log('Transaction was already submitted');
            throw new Error('Transaction was already submitted. Please wait for confirmation.');
          }
          throw submitErr;
        }
      }

      if (!txHash) {
        txHash = `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
      }

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
      setWalletError('');
      
      console.log('✅ Transaction recorded in history');
      
      setTimeout(async () => {
        await fetchWalletBalance();
      }, 2000);
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

  return (
    <div className="app">
      <div className="app-shell">
        <aside className="sidebar">
          <div className="sidebar-header">
            <img src={logo} className="sidebar-logo" alt="Logo" />
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
        <div className="content">
          {activeView === "notes" && (
            <Notes
              form={form}
              notes={notes}
              handleChange={handleChange}
              addNote={addNote}
              deleteNote={deleteNote}
              showDeleteModal={showDeleteModal}
              setShowDeleteModal={setShowDeleteModal}
              noteToDelete={noteToDelete}
              setNoteToDelete={setNoteToDelete}
            />
          )}

          {activeView === "wallet" && (
            <Wallet
              logo={logo}
              walletStatus={walletStatus}
              walletInfo={walletInfo}
              walletError={walletError}
              walletRefreshing={walletRefreshing}
              txSending={txSending}
              txForm={txForm}
              network={network}
              detectedNetwork={detectedNetwork}
              txHistory={txHistory}
              addressCopied={addressCopied}
              SAVED_ADDRESSES={SAVED_ADDRESSES}
              setNetwork={handleNetworkChange}
              formatAddress={formatAddress}
              copyAddress={copyAddress}
              sendFunds={sendFunds}
              handleTxFormChange={handleTxFormChange}
              fetchWalletBalance={fetchWalletBalance}
              selectSavedAddress={selectSavedAddress}
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