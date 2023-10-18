import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { CleverTodo } from '../target/types/clever_todo';

describe('clever_todo', () => {
    // Configure the client to use the local cluster.
    anchor.setProvider(anchor.AnchorProvider.env());

    const program = anchor.workspace.CleverTodo as Program<CleverTodo>;

    const authority = anchor.web3.Keypair.generate();

    const connection = anchor.getProvider().connection;

    it('Is initialized!', async () => {
        console.log(connection);
        const signature = await connection.requestAirdrop(
            authority.publicKey,
            anchor.web3.LAMPORTS_PER_SOL
        );

        await connection.confirmTransaction(signature);

        const [profilePda, bump] = anchor.web3.PublicKey.findProgramAddressSync(
            [
                new TextEncoder().encode('USER_STATE'),
                authority.publicKey.toBuffer(),
            ],
            program.programId
        );

        // Add your test here.
        const tx = await program.methods
            .initializeUser()
            .accounts({
                authority: authority.publicKey,
                userProfile: profilePda,
                systemProgram: anchor.web3.SystemProgram.programId,
            })
            .signers([authority])
            .rpc();
        console.log('Your transaction signature', tx);
    });
});