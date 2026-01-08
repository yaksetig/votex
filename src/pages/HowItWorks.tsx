
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Vote, KeyRound, Eye, Lock, UserCheck, AlertTriangle } from "lucide-react";

const HowItWorks = () => {
  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-400">
          How Votex Works
        </h1>
        <p className="text-muted-foreground text-lg">
          A coercion-resistant voting system that protects your privacy
        </p>
      </div>

      {/* What is Votex */}
      <section className="mb-10">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              What is Votex?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-muted-foreground">
            <p>
              Votex is a privacy-preserving voting system designed to be <strong>coercion-resistant</strong>. 
              This means that even if someone forces you to vote a certain way, you can secretly cancel 
              that vote without anyone knowing.
            </p>
            <p>
              All votes are encrypted using advanced cryptography, and zero-knowledge proofs ensure 
              that your actions remain private.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Getting Started */}
      <section className="mb-10">
        <h2 className="text-2xl font-semibold mb-4">Getting Started</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-green-500" />
                1. Verify Your Identity
              </CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground text-sm">
              Sign in with World ID to prove you're a unique human. This prevents 
              anyone from voting multiple times while keeping your identity private.
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-blue-500" />
                2. Generate Your Keypair
              </CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground text-sm">
              A unique cryptographic keypair is generated for you. Your private key 
              stays with you and is used to sign your votes and nullification requests.
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Casting a Vote */}
      <section className="mb-10">
        <h2 className="text-2xl font-semibold mb-4">Casting Your Vote</h2>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Vote className="h-5 w-5 text-primary" />
              How Voting Works
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground">
            <ol className="list-decimal list-inside space-y-3">
              <li>
                <strong>Browse Elections:</strong> View all available elections and their details.
              </li>
              <li>
                <strong>Join an Election:</strong> Register to participate with your public key.
              </li>
              <li>
                <strong>Cast Your Vote:</strong> Your vote is cast and no one knows who it came 
                from due to the anonymous World authentication.
              </li>
              <li>
                <strong>Cryptographic Proof:</strong> Your vote is signed with your private key, 
                proving it came from a real human.
              </li>
            </ol>
          </CardContent>
        </Card>
      </section>

      {/* Vote Nullification */}
      <section className="mb-10">
        <h2 className="text-2xl font-semibold mb-4">Vote Nullification</h2>
        <Card className="border-orange-500/30 bg-orange-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              The Anti-Coercion Feature
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground">
            <p>
              <strong>What if someone forces you to vote a certain way?</strong>
            </p>
            <p>
              Votex allows you to <strong>nullify</strong> your vote in complete secrecy. When you 
              nullify, your vote is cancelled and won't be counted in the final tally.
            </p>
            <div className="bg-background/50 rounded-lg p-4 space-y-2">
              <p className="font-medium text-foreground">How it stays private:</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>
                  <strong>Zero-Knowledge Proofs:</strong> You prove you have the right to nullify 
                  without revealing who you are.
                </li>
                <li>
                  <strong>k-Anonymity:</strong> Your nullification request is mixed with others, 
                  making it impossible to trace back to you.
                </li>
                <li>
                  <strong>Encrypted Communication:</strong> All nullification data is encrypted 
                  so only the election authority can process it.
                </li>
              </ul>
            </div>
            <p className="text-sm italic">
              Even if a coercer is watching you vote, they can never know if you later nullified.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Security Guarantees */}
      <section className="mb-10">
        <h2 className="text-2xl font-semibold mb-4">Security & Privacy Guarantees</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Lock className="h-5 w-5 text-primary" />
                End-to-End Encryption
              </CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground text-sm">
              Your vote is encrypted the moment you cast it. Only the election authority 
              can decrypt the final tally, and individual votes are never revealed.
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Eye className="h-5 w-5 text-primary" />
                Vote Secrecy
              </CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground text-sm">
              No one—not even the election authority—can see how you voted. The system 
              uses homomorphic encryption to tally votes without decrypting them individually.
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Coercion Resistance
              </CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground text-sm">
              Even if forced to vote under pressure, you can always nullify privately. 
              There's no way for a coercer to verify your final vote.
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-primary" />
                One Person, One Vote
              </CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground text-sm">
              World ID verification ensures each person can only vote once per election, 
              preventing fraud while maintaining privacy.
            </CardContent>
          </Card>
        </div>
      </section>

      {/* FAQ */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Frequently Asked Questions</h2>
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Can I change my vote?</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground text-sm">
              You cannot change your vote, but you can nullify it. A nullified vote is not 
              counted in the final tally.
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Who can see my vote?</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground text-sm">
              No one. Your vote is encrypted and mixed with others. Only the final tally 
              is revealed, never individual votes.
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">What happens if I nullify?</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground text-sm">
              Your original vote is cancelled and won't be counted. The system ensures 
              no one can tell that you nullified, protecting you from retaliation.
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
};

export default HowItWorks;
