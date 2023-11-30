import {
  useActiveClaimConditionForWallet,
  useAddress,
  useClaimConditions,
  useClaimerProofs,
  useClaimIneligibilityReasons,
  useContract,
  useContractMetadata,
  useTokenSupply,
  useTokenBalance,
  ConnectWallet,
  Web3Button,
} from "@thirdweb-dev/react";
import { BigNumber, utils } from "ethers";
import Image from "next/image";
import { useMemo, useState } from "react";
import styles from "../styles/Home.module.css";
import { parseIneligibility } from "../utils/parseIneligibility";

const Home = () => {
  const tokenAddress = "0xe5D25E3d686a189e020f61B0DcCD184eB5D4cdB4";
  const { contract } = useContract(tokenAddress, "token-drop");
  const address = useAddress();
  const [quantity, setQuantity] = useState(1);
  const { data: contractMetadata } = useContractMetadata(contract);
  const { data: tokenSupply } = useTokenSupply(contract);
  const { data: claimTokens } = useClaimConditions(contract);
  const { data: tokenBalance } = useTokenBalance(contract, address);

  const claimConditions = useClaimConditions(contract);
  const activeClaimCondition = useActiveClaimConditionForWallet(
    contract,
    address
  );

  const claimerProofs = useClaimerProofs(contract, address || "");
  const claimIneligibilityReasons = useClaimIneligibilityReasons(contract, {
    quantity,
    walletAddress: address || "",
  });

  const claimedSupply = useTokenSupply(contract);

  const remainingSupply = (Number(activeClaimCondition.data?.availableSupply)).toLocaleString('en-US');

  // const remainingSupply = (Number(activeClaimCondition.data?.availableSupply) - 385000000).toLocaleString('en-US');

  const totalAvailableSupply = useMemo(() => {
    try {
      return BigNumber.from(activeClaimCondition.data?.availableSupply || 0);
    } catch {
      return BigNumber.from(750_000);
    }
  }, [activeClaimCondition.data?.availableSupply]);

  const numberClaimed = useMemo(() => {
    return BigNumber.from(claimedSupply.data?.value || 0).toString();
  }, [claimedSupply]);

  const numberTotal = useMemo(() => {
    const n = totalAvailableSupply.add(
      BigNumber.from(claimedSupply.data?.value || 0)
    );
    if (n.gte(750_000)) {
      return "";
    }
    return n.toString();
  }, [totalAvailableSupply, claimedSupply]);

  const priceToMint = useMemo(() => {
    if (quantity) {
      const bnPrice = BigNumber.from(
        activeClaimCondition.data?.currencyMetadata.value || 0
      );
      return `${utils.formatUnits(
        bnPrice.mul(quantity).toString(),
        activeClaimCondition.data?.currencyMetadata.decimals || 18
      )} ${activeClaimCondition.data?.currencyMetadata.symbol}`;
    }
  }, [
    activeClaimCondition.data?.currencyMetadata.decimals,
    activeClaimCondition.data?.currencyMetadata.symbol,
    activeClaimCondition.data?.currencyMetadata.value,
    quantity,
  ]);

  const maxClaimable = useMemo(() => {
    let bnMaxClaimable;
    try {
      bnMaxClaimable = BigNumber.from(
        activeClaimCondition.data?.maxClaimableSupply || 0
      );
    } catch (e) {
      bnMaxClaimable = BigNumber.from(750_000);
    }

    let perTransactionClaimable;
    try {
      perTransactionClaimable = BigNumber.from(
        activeClaimCondition.data?.maxClaimablePerWallet || 0
      );
    } catch (e) {
      perTransactionClaimable = BigNumber.from(750_000);
    }

    if (perTransactionClaimable.lte(bnMaxClaimable)) {
      bnMaxClaimable = perTransactionClaimable;
    }

    const snapshotClaimable = claimerProofs.data?.maxClaimable;

    if (snapshotClaimable) {
      if (snapshotClaimable === "0") {
        // allowed unlimited for the snapshot
        bnMaxClaimable = BigNumber.from(750_000);
      } else {
        try {
          bnMaxClaimable = BigNumber.from(snapshotClaimable);
        } catch (e) {
          // fall back to default case
        }
      }
    }

    let max;
    if (totalAvailableSupply.lt(bnMaxClaimable)) {
      max = totalAvailableSupply;
    } else {
      max = bnMaxClaimable;
    }

    if (max.gte(750_000)) {
      return 750_000;
    }
    return max.toNumber();
  }, [
    claimerProofs.data?.maxClaimable,
    totalAvailableSupply,
    activeClaimCondition.data?.maxClaimableSupply,
    activeClaimCondition.data?.maxClaimablePerWallet,
  ]);

  const isSoldOut = useMemo(() => {
    try {
      return (
        (activeClaimCondition.isSuccess &&
          BigNumber.from(activeClaimCondition.data?.availableSupply || 0).lte(
            0
          )) ||
        numberClaimed === numberTotal
      );
    } catch (e) {
      return false;
    }
  }, [
    activeClaimCondition.data?.availableSupply,
    activeClaimCondition.isSuccess,
    numberClaimed,
    numberTotal,
  ]);

  const canClaim = useMemo(() => {
    return (
      activeClaimCondition.isSuccess &&
      claimIneligibilityReasons.isSuccess &&
      claimIneligibilityReasons.data?.length === 0 &&
      !isSoldOut
    );
  }, [
    activeClaimCondition.isSuccess,
    claimIneligibilityReasons.data?.length,
    claimIneligibilityReasons.isSuccess,
    isSoldOut,
  ]);

  const isLoading = useMemo(() => {
    return activeClaimCondition.isLoading || !contract;
  }, [activeClaimCondition.isLoading, contract]);

  const buttonLoading = useMemo(
    () => isLoading || claimIneligibilityReasons.isLoading,
    [claimIneligibilityReasons.isLoading, isLoading]
  );
  const buttonText = useMemo(() => {
    if (isSoldOut) {
      return "";
    }

    if (canClaim) {
      const pricePerToken = BigNumber.from(
        activeClaimCondition.data?.currencyMetadata.value || 0
      );
      if (pricePerToken.eq(0)) {
        return "Mint (Free)";
      }
      return `TOTAL COSTS: ${priceToMint}`;
    }
    if (claimIneligibilityReasons.data?.length) {
      return parseIneligibility(claimIneligibilityReasons.data, quantity);
    }
    if (buttonLoading) {
      return "";
    }

    return "";
  }, [
    isSoldOut,
    canClaim,
    claimIneligibilityReasons.data,
    buttonLoading,
    activeClaimCondition.data?.currencyMetadata.value,
    priceToMint,
    quantity,
  ]);

  return (


  <div className={styles.container}>
  <div className={styles.connect}>

  <ConnectWallet
              dropdownPosition={{
                side: "bottom",
                align: "center",
              }}
            />
  </div>
  <div className={styles.balance}>
  <p>YOUR FOIC BALANCE:</p>
  <p>{tokenBalance?.displayValue} {tokenBalance?.symbol}</p>
  </div>

  <Image
     src="/main.jpg"
     alt=""
     quality="100"
     sizes="(max-width: 500px) 100vw,
         (max-width: 700px) 50vw,
         33vw"
   />

      {(claimConditions.data &&
        claimConditions.data.length > 0 &&
        activeClaimCondition.isError) ||
        (activeClaimCondition.data &&
          activeClaimCondition.data.startTime > new Date() && (
            <p>Presale is starting soon.</p>
          ))}

      {claimConditions.data?.length === 0 ||
        (claimConditions.data?.every((cc) => cc.maxClaimableSupply === "0") && (
          <p>
            The presale has not started yet.
          </p>
        ))}

      {isLoading ? (
        <p>Loading...</p>
      ) : (
        <>

        <p className={styles.explain}>
        <p>REMAINING PRESALE SUPPLY</p>
        <p>{remainingSupply} / 115,000,000 FOIC</p>
        </p>

          <div className={styles.claimGrid}>
            <input
              type="number"
              placeholder="Enter amount"
              onChange={(e) => {
                const value = parseInt(e.target.value);
                if (value > maxClaimable) {
                  setQuantity(maxClaimable);
                } else if (value < 1) {
                  setQuantity(1);
                } else {
                  setQuantity(value);
                }
              }}
              value={quantity}
              className={`${styles.textInput} ${styles.noGapBottom}`}
            />
            <Web3Button
              contractAddress={tokenAddress}
              action={(contract) => contract.erc20.claim(quantity)}
            >
            <p>BUY</p>
            </Web3Button>
          </div>

        </>
      )}
      <p>{buttonText}</p>

    </div>

  );
};

export default Home;
