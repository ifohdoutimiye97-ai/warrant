// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title AttestationVerifier
/// @notice A production-safe warrant verifier that accepts an ECDSA
///         attestation signed by a trusted scout authority over the
///         tuple (strategyId, proposalHash, executionHash). This is the
///         contract Warrant uses as the `PROOF_SYSTEM_VERIFIER_ADDRESS`
///         in production, so that ProofVerifier's "embedded demo mode"
///         path is never touched on mainnet.
///
///         This is NOT a full zk verifier — future versions of Warrant
///         can swap this contract out for a groth16/plonk verifier that
///         validates a circuit proof instead of an ECDSA signature. The
///         interface (`verify(bytes, bytes32[])`) is the same in both
///         cases, so the swap is a single setVerifier() call on
///         ProofVerifier.
contract AttestationVerifier {
    /// @notice Address allowed to sign attestations. Ownership transfer
    ///         lets an operator rotate the signer if a key is compromised.
    address public owner;
    address public authorizedSigner;

    event SignerUpdated(address indexed signer);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(address initialSigner) {
        require(initialSigner != address(0), "Signer required");
        owner = msg.sender;
        authorizedSigner = initialSigner;
        emit OwnershipTransferred(address(0), msg.sender);
        emit SignerUpdated(initialSigner);
    }

    function setSigner(address newSigner) external onlyOwner {
        require(newSigner != address(0), "Signer required");
        authorizedSigner = newSigner;
        emit SignerUpdated(newSigner);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Owner required");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    /// @notice Matches the `IZkVerifier` interface ProofVerifier calls.
    ///         publicInputs MUST be `[strategyId, proposalHash, executionHash]`
    ///         (in that order) and proofData MUST be a 65-byte ECDSA
    ///         signature (r || s || v) produced by `authorizedSigner`
    ///         over `keccak256(abi.encodePacked(publicInputs))` prefixed
    ///         with the standard EIP-191 personal_sign header.
    function verify(bytes calldata proofData, bytes32[] calldata publicInputs)
        external
        view
        returns (bool)
    {
        if (publicInputs.length != 3) return false;
        if (proofData.length != 65) return false;

        bytes32 digest = keccak256(
            abi.encodePacked(publicInputs[0], publicInputs[1], publicInputs[2])
        );

        // EIP-191 personal_sign prefix
        bytes32 ethSignedDigest = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", digest)
        );

        address recovered = _recover(ethSignedDigest, proofData);
        return recovered != address(0) && recovered == authorizedSigner;
    }

    function _recover(bytes32 digest, bytes calldata sig) internal pure returns (address) {
        // Inline ECDSA recovery for a 65-byte signature (r || s || v).
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }
        if (v < 27) {
            v += 27;
        }
        if (v != 27 && v != 28) {
            return address(0);
        }
        // Reject non-canonical signatures where s > secp256k1n / 2.
        // The constant below is secp256k1n / 2, defined as:
        //   0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141 / 2
        // Reference: EIP-2, OpenZeppelin ECDSA.sol
        if (
            uint256(s) >
            0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0
        ) {
            return address(0);
        }
        return ecrecover(digest, v, r, s);
    }
}
